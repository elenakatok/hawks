import { useState } from 'react'
import { httpsCallable } from 'firebase/functions'
import { InstructorDashboard as SharedDashboard, GroupsControlPanel, type DeadlockResolutionProps, type OutcomeFields } from '@mygames/game-ui'
import { auth, functions, rtdb } from '../firebase'
import { hawksConfig } from '../gameConfig'

const roleLabels = Object.fromEntries(
  hawksConfig.roles.map(r => [r.key, r.label])
)

// ── Deadlock resolution control (PLACEHOLDER — real deal fields in Part 3) ────
// Uses the single placeholder integer field from hawksSchema.

function HawksDeadlockControl({ submitting, error, onSubmit }: DeadlockResolutionProps) {
  const [placeholder, setPlaceholder] = useState('')
  const [noDeal, setNoDeal] = useState(false)

  const handleSubmit = () => {
    if (noDeal) { onSubmit({ no_deal: true }); return }
    const n = parseInt(placeholder, 10)
    if (isNaN(n)) return
    const outcome: OutcomeFields = { placeholder: n }
    onSubmit(outcome)
  }

  const inputStyle: React.CSSProperties = {
    fontSize: '0.875rem', padding: '0.3rem 0.5rem', borderRadius: 3, border: '1px solid #ccc',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {!noDeal && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <label style={{ fontSize: '0.875rem', minWidth: '7rem' }}>Placeholder (0–100)</label>
          <input
            type="number" min={0} max={100} step={1}
            placeholder="0" value={placeholder}
            onChange={e => setPlaceholder(e.target.value)}
            style={{ ...inputStyle, width: '6rem' }}
            disabled={submitting}
          />
        </div>
      )}
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.25rem' }}>
        <button
          onClick={handleSubmit}
          disabled={submitting || (!noDeal && placeholder === '')}
        >
          {submitting ? '…' : noDeal ? 'Confirm No Deal' : 'Lock Deal'}
        </button>
        <button
          onClick={() => setNoDeal(v => !v)}
          disabled={submitting}
          style={{ background: 'none', border: '1px solid #ccc' }}
        >
          {noDeal ? 'Enter deal terms instead' : 'No deal'}
        </button>
      </div>
      {error && <p style={{ color: '#c00', fontSize: '0.8rem', margin: 0 }}>{error}</p>}
    </div>
  )
}

async function submitInstructorOutcome(groupId: string, outcome: OutcomeFields): Promise<void> {
  const fn = httpsCallable(functions, 'submitInstructorOutcome')
  await fn({ group_id: groupId, outcome })
}

export default function InstructorDashboard() {
  return (
    <SharedDashboard
      title="Instructor Dashboard — Hawks"
      roleLabels={roleLabels}
      // CRITICAL: pass composition so canMatch gates on ≥1 angel + ≥1 agent + ≥2 hawks
      composition={{ angel: 1, agent: 1, hawks: 2 }}
      DeadlockResolutionControl={HawksDeadlockControl}
      submitInstructorOutcome={submitInstructorOutcome}
      functions={functions}
      auth={auth}
      rtdb={rtdb}
      settingsRoute="/settings"
      reportsRoute="/reports"
      scoreAndRecord={{ callableName: 'scoreAndRecord', label: 'Score & Record' }}
      underHeadline={<GroupsControlPanel functions={functions} auth={auth} roleLabels={roleLabels} testId="hawks-groups" />}
    />
  )
}
