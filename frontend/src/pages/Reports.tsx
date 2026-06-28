import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { httpsCallable } from 'firebase/functions'
import { signInWithCustomToken, signOut } from 'firebase/auth'
import { auth, functions } from '../firebase'
import {
  SortableTable,
  ReportBoard,
  GameHeader,
  ExportModal,
  buildStudentTextExport,
  type SortableColumn,
  type ReportTileConfig,
  type AiTextRow,
} from '@mygames/game-ui'

// ── Types ─────────────────────────────────────────────────────────────────────

type ReportRow = {
  participant_id: string
  display_name: string
  group_number: number | null
  role: string
  // Real negotiated outcome fields (units $M; M is a 0–1 fraction).
  S: number | null
  M: number | null
  B: number | null
  value_or_cost: number | null
  raw_score: number | null
  text_answers: Record<string, string>
  notes: string | null
}

type QuestionMeta = { field: string; prompt: string; role_target: string }

// ── Role labels — 3 real roles ────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  angel: 'Angel',
  agent: 'Agent',
  hawks: 'Hawks',
}

function fmt(n: number | null): string {
  return n == null ? '—' : n.toLocaleString('en-US')
}

function fmtSigned(n: number | null): string {
  if (n == null) return '—'
  return (n >= 0 ? '+' : '−') + Math.abs(n).toLocaleString('en-US')
}

// Fixed-precision decimal — matches the outcome form's step (S/B → 0.1, M → 0.01).
function fmtDec(n: number | null, dp: number): string {
  return n == null ? '—' : n.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp })
}

// ── Sortable columns ──────────────────────────────────────────────────────────

type SortKey = 'name' | 'group' | 'role' | 'S' | 'M' | 'B' | 'value_or_cost' | 'raw_score' | 'notes'

const COLUMNS: readonly SortableColumn<ReportRow, SortKey>[] = [
  {
    key: 'name', label: 'Name', headerStyle: { minWidth: 140 },
    render: r => r.display_name,
    compare: (a, b) => a.display_name.localeCompare(b.display_name),
  },
  {
    key: 'group', label: 'Group #',
    render: r => r.group_number ?? '—',
    compare: (a, b) => (a.group_number ?? Infinity) - (b.group_number ?? Infinity),
  },
  {
    key: 'role', label: 'Role',
    render: r => ROLE_LABELS[r.role] ?? r.role,
    compare: (a, b) => a.role.localeCompare(b.role),
  },
  {
    key: 'S', label: 'Base salary ($M)', nullsLast: true, isNull: r => r.S === null,
    tiebreak: (a, b) => a.display_name.localeCompare(b.display_name),
    render: r => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtDec(r.S, 1)}</span>,
    compare: (a, b) => (a.S ?? 0) - (b.S ?? 0),
  },
  {
    key: 'M', label: 'Merch fraction', nullsLast: true, isNull: r => r.M === null,
    tiebreak: (a, b) => a.display_name.localeCompare(b.display_name),
    render: r => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtDec(r.M, 2)}</span>,
    compare: (a, b) => (a.M ?? 0) - (b.M ?? 0),
  },
  {
    key: 'B', label: 'Champ bonus ($M)', nullsLast: true, isNull: r => r.B === null,
    tiebreak: (a, b) => a.display_name.localeCompare(b.display_name),
    render: r => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtDec(r.B, 1)}</span>,
    compare: (a, b) => (a.B ?? 0) - (b.B ?? 0),
  },
  {
    key: 'value_or_cost', label: 'Value / Cost', nullsLast: true, isNull: r => r.value_or_cost === null,
    tiebreak: (a, b) => a.display_name.localeCompare(b.display_name),
    render: r => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(r.value_or_cost)}</span>,
    compare: (a, b) => (a.value_or_cost ?? 0) - (b.value_or_cost ?? 0),
  },
  {
    key: 'raw_score', label: 'Raw score', nullsLast: true, isNull: r => r.raw_score === null,
    tiebreak: (a, b) => a.display_name.localeCompare(b.display_name),
    render: r => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtSigned(r.raw_score)}</span>,
    compare: (a, b) => (a.raw_score ?? 0) - (b.raw_score ?? 0),
  },
  {
    key: 'notes', label: 'Notes', headerStyle: { minWidth: 220 },
    nullsLast: true, isNull: r => !r.notes || !r.notes.trim(),
    tiebreak: (a, b) => a.display_name.localeCompare(b.display_name),
    render: r => (r.notes && r.notes.trim())
      ? <span style={{ whiteSpace: 'pre-wrap', display: 'inline-block', maxWidth: 360 }}>{r.notes}</span>
      : '—',
    compare: (a, b) => (a.notes ?? '').localeCompare(b.notes ?? ''),
  },
]

// ── Page component ────────────────────────────────────────────────────────────

export default function Reports() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const devGameInstanceId = import.meta.env.DEV
    ? searchParams.get('_dev_game_instance_id')
    : null
  const tokenParam          = searchParams.get('token')
  const gameInstanceIdParam = searchParams.get('game_instance_id')

  const [sessionReady, setSessionReady] = useState(false)
  const [authError,    setAuthError]    = useState<string | null>(null)

  const makeLink = (base: string): string => {
    if (devGameInstanceId) return `${base}?_dev_game_instance_id=${encodeURIComponent(devGameInstanceId)}`
    if (tokenParam && gameInstanceIdParam)
      return `${base}?token=${encodeURIComponent(tokenParam)}&game_instance_id=${encodeURIComponent(gameInstanceIdParam)}`
    return base
  }

  // ── Auth bootstrap ─────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    const establish = async () => {
      await auth.authStateReady()
      if (cancelled) return
      if (auth.currentUser) {
        const expectedUid = devGameInstanceId
          ? `instructor_${devGameInstanceId}`
          : gameInstanceIdParam ? `instructor_${gameInstanceIdParam}` : null
        if (expectedUid && auth.currentUser.uid === expectedUid) { setSessionReady(true); return }
        await signOut(auth)
        if (cancelled) return
      }
      const args = devGameInstanceId
        ? { _dev: { game_instance_id: devGameInstanceId } }
        : tokenParam ? { token: tokenParam } : null
      if (!args) { setAuthError('No launch token found.'); return }
      try {
        const fn = httpsCallable<object, { customToken: string }>(functions, 'getInstructorSession')
        const res = await fn(args)
        if (cancelled) return
        await signInWithCustomToken(auth, res.data.customToken)
        if (cancelled) return
        setSessionReady(true)
      } catch (err) {
        if (cancelled) return
        setAuthError(err instanceof Error ? err.message : 'Failed to establish session.')
      }
    }
    void establish()
    return () => { cancelled = true }
  }, [devGameInstanceId, tokenParam]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Data load ──────────────────────────────────────────────────────────────
  const [rows,      setRows]      = useState<ReportRow[] | null>(null)
  const [questions, setQuestions] = useState<QuestionMeta[]>([])
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState<string | null>(null)

  useEffect(() => {
    if (!sessionReady) return
    setLoading(true)
    setError(null)
    const fn = httpsCallable<object, { ok: boolean; rows: ReportRow[]; questions: QuestionMeta[] }>(functions, 'getReportData')
    fn({}).then(r => {
      setRows(r.data.rows)
      setQuestions(r.data.questions)
      setLoading(false)
    }).catch((err: unknown) => {
      setError(err instanceof Error ? err.message : 'Failed to load report data.')
      setLoading(false)
    })
  }, [sessionReady])

  // ── Modal state ────────────────────────────────────────────────────────────
  const [contractOpen, setContractOpen] = useState(false)
  const [activeExport, setActiveExport] = useState<{ title: string; text: string } | null>(null)

  // ── Tile config — scatter tile removed (game-specific; deferred to Part 3) ──
  const finalized = rows?.length ?? 0

  const tiles: ReportTileConfig[] = [
    {
      id: 'contract-outcomes',
      title: 'Contract Outcomes — per participant',
      preview: rows == null
        ? <span style={{ color: '#888', fontSize: '0.85rem' }}>{loading ? 'Loading…' : 'No data'}</span>
        : <span style={{ fontSize: '0.9rem', color: '#555' }}>
            {finalized} participant{finalized !== 1 ? 's' : ''} finalized
          </span>,
      onOpen: () => setContractOpen(true),
      disabled: !rows || rows.length === 0,
      actionLabel: 'Open ↗',
    },
    // Text-question tiles (one per prep text question from prepDefaults).
    ...questions.map(q => {
      const roleLabel = ROLE_LABELS[q.role_target] ?? q.role_target
      const tileTitle = `${roleLabel}: ${q.prompt}`
      const qRows: AiTextRow[] = (rows ?? [])
        .filter(r => r.role === q.role_target && r.text_answers[q.field])
        .map(r => ({ name: r.display_name, raw_score: r.raw_score, answer: r.text_answers[q.field] }))
      const text = buildStudentTextExport(tileTitle, qRows)
      return {
        id: q.field,
        title: tileTitle,
        preview: qRows.length === 0
          ? <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>No responses yet.</span>
          : <span style={{ fontSize: '1.25rem', fontWeight: 700, color: '#111' }}>
              {qRows.length} response{qRows.length !== 1 ? 's' : ''}
            </span>,
        onOpen: () => setActiveExport({ title: tileTitle, text }),
        disabled: !rows,
        actionLabel: 'Open ↗',
      } satisfies ReportTileConfig
    }),
  ]

  // ── Render ─────────────────────────────────────────────────────────────────
  if (authError) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p style={{ color: '#c00' }}>{authError}</p>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <GameHeader />

      <div style={{ padding: '1rem 1.5rem 0.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <button
          onClick={() => navigate(makeLink('/dashboard'))}
          style={{ background: 'none', border: '1px solid #ccc', borderRadius: 4, padding: '0.3rem 0.8rem', cursor: 'pointer', fontSize: '0.85rem' }}
        >
          ← Dashboard
        </button>
        <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>Reports — Hawks</h2>
      </div>

      <main style={{ flex: 1, padding: '1rem 1.5rem' }}>
        {error && <p style={{ color: '#c00', marginBottom: '1rem' }}>{error}</p>}
        <ReportBoard tiles={tiles} />
      </main>

      {contractOpen && (
        <div
          onClick={() => setContractOpen(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
            display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
            padding: '3rem 1rem', zIndex: 1000, overflowY: 'auto',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#fff', borderRadius: 8, boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
              width: '100%', maxWidth: 1100, padding: '1.25rem 1.5rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Contract Outcomes — per participant</h3>
              <button
                onClick={() => setContractOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#666' }}
              >
                ✕
              </button>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <SortableTable<ReportRow, SortKey>
                rows={rows ?? []}
                columns={COLUMNS}
                getRowKey={r => r.participant_id}
                initialSortKey="group"
                roleLabels={ROLE_LABELS}
                getRowRole={r => r.role}
                emptyMessage="No finalized participants yet."
              />
            </div>
          </div>
        </div>
      )}

      {activeExport && (
        <ExportModal
          title={activeExport.title}
          text={activeExport.text}
          onClose={() => setActiveExport(null)}
        />
      )}
    </div>
  )
}
