import type { Outcome, OutcomeSchema, RoleConfig } from '@mygames/game-engine'
import type { GameDefinition } from '@mygames/game-server'

// ── Role config ───────────────────────────────────────────────────────────────

export const hawksConfig: RoleConfig = {
  roles: [
    { key: 'angel', label: 'Angel', short: 'A' },
    { key: 'agent', label: 'Agent', short: 'G' },
    { key: 'hawks', label: 'Hawks', short: 'H' },
  ],
}

// ── Outcome schema (PLACEHOLDER — real deal fields added in Part 3) ───────────

export const hawksSchema: OutcomeSchema = [
  { key: 'placeholder', type: 'integer', min: 0, max: 100 },
]

// ── Score sense (all value-sense — real scoring in Part 3) ───────────────────

export const hawksScoreSense: Record<string, 'value' | 'cost'> = {
  angel: 'value',
  agent: 'value',
  hawks: 'value',
}

// ── Scoring (PLACEHOLDER — returns 0 for every role; real formulas in Part 3) ─

export function computeScoreBreakdown(
  _roleKey: string,
  _outcome: Outcome | null,
  _configData?: Record<string, unknown>,
): { value_or_cost: number; raw_score: number } {
  return { value_or_cost: 0, raw_score: 0 }
}

export function computeRawScore(
  roleKey: string,
  outcome: Outcome | null,
  configData?: Record<string, unknown>,
): number {
  return computeScoreBreakdown(roleKey, outcome, configData).raw_score
}

// ── GameDefinition ────────────────────────────────────────────────────────────

export const hawksGameDef: GameDefinition = {
  game_id: 'hawks',
  roles:   hawksConfig,
  scoreSense: hawksScoreSense,
  composition: { angel: 1, agent: 1, hawks: 2 },
  outcomeSchema: hawksSchema,
  computeRawScore,
  computeScoreBreakdown,
  // reservations: PLACEHOLDER — real values in Part 3
  reservations: { angel: 0, agent: 0, hawks: 0 },
  corsOrigins: ['https://hawks.mygames.live'],
  classroom: { callbackSecretId: 'hawks_v1' },
  // perRoleCap omitted → no cap (place every extra)
  // deadlockThreshold omitted → 5

  // Settings page config fields (PLACEHOLDER — minimal; real sheet/worksheet URLs in Part 3)
  configFields: [
    { key: 'angel_role_name',          kind: 'string',      default: 'Angel' },
    { key: 'agent_role_name',          kind: 'string',      default: 'Agent' },
    { key: 'hawks_role_name',          kind: 'string',      default: 'Hawks' },
    { key: 'angel_reservation_price',  kind: 'positiveInt', default: 0 },
    { key: 'agent_reservation_price',  kind: 'positiveInt', default: 0 },
    { key: 'hawks_reservation_price',  kind: 'positiveInt', default: 0 },
    // Placeholder PDF URL fields — Elena drops real PDFs in public/role-info/
    { key: 'angel_sheet_url',          kind: 'url',         default: '/role-info/angel.pdf' },
    { key: 'agent_sheet_url',          kind: 'url',         default: '/role-info/agent.pdf' },
    { key: 'hawks_sheet_url',          kind: 'url',         default: '/role-info/hawks.pdf' },
  ],

  // Info page links — keys must appear in configFields above
  roleInfoLinks: [
    { roleKey: 'angel', links: [{ key: 'angel_sheet_url', label: 'Role sheet' }] },
    { roleKey: 'agent', links: [{ key: 'agent_sheet_url', label: 'Role sheet' }] },
    { roleKey: 'hawks', links: [{ key: 'hawks_sheet_url', label: 'Role sheet' }] },
  ],

  // ── prepDefaults: 3 system gates + 1 dummy graded MC per role ────────────
  // PLACEHOLDER — real KC content in Part 2. Structure is correct so validateKCGate passes.
  prepDefaults: [
    // ── Q1: Role-identification gates (system, one per role) ─────────────────
    {
      field: 'kc_gate_angel', type: 'mc', system: true,
      category: 'knowledge_check', format: 'multiple_choice',
      grading: 'assigned_role', role_target: 'angel',
      prompt: 'What is your role in this negotiation?',
      placeholder: '', order: 0, hidden: false, deletable: false,
      options: [
        { value: 'angel', label: 'Angel — the early investor' },
        { value: 'agent', label: 'Agent — the intermediary' },
        { value: 'hawks', label: 'Hawks — the acquiring team' },
      ],
      explanation: 'You are the Angel investor.',
    },
    {
      field: 'kc_gate_agent', type: 'mc', system: true,
      category: 'knowledge_check', format: 'multiple_choice',
      grading: 'assigned_role', role_target: 'agent',
      prompt: 'What is your role in this negotiation?',
      placeholder: '', order: 0, hidden: false, deletable: false,
      options: [
        { value: 'angel', label: 'Angel — the early investor' },
        { value: 'agent', label: 'Agent — the intermediary' },
        { value: 'hawks', label: 'Hawks — the acquiring team' },
      ],
      explanation: 'You are the Agent.',
    },
    {
      field: 'kc_gate_hawks', type: 'mc', system: true,
      category: 'knowledge_check', format: 'multiple_choice',
      grading: 'assigned_role', role_target: 'hawks',
      prompt: 'What is your role in this negotiation?',
      placeholder: '', order: 0, hidden: false, deletable: false,
      options: [
        { value: 'angel', label: 'Angel — the early investor' },
        { value: 'agent', label: 'Agent — the intermediary' },
        { value: 'hawks', label: 'Hawks — the acquiring team' },
      ],
      explanation: 'You are on the Hawks acquiring team.',
    },

    // ── Dummy graded MC per role (PLACEHOLDER — real questions in Part 2) ────
    {
      field: 'kc_angel_q1', type: 'mc', system: false,
      category: 'knowledge_check', format: 'multiple_choice',
      grading: 'static', correct_value: 'a', role_target: 'angel',
      prompt: '[PLACEHOLDER] Sample question for Angel role.',
      placeholder: '', order: 10, hidden: false, deletable: false,
      options: [
        { value: 'a', label: 'Option A (correct)' },
        { value: 'b', label: 'Option B' },
        { value: 'c', label: 'Option C' },
      ],
      explanation: '[PLACEHOLDER] Real explanation goes here in Part 2.',
    },
    {
      field: 'kc_agent_q1', type: 'mc', system: false,
      category: 'knowledge_check', format: 'multiple_choice',
      grading: 'static', correct_value: 'a', role_target: 'agent',
      prompt: '[PLACEHOLDER] Sample question for Agent role.',
      placeholder: '', order: 10, hidden: false, deletable: false,
      options: [
        { value: 'a', label: 'Option A (correct)' },
        { value: 'b', label: 'Option B' },
        { value: 'c', label: 'Option C' },
      ],
      explanation: '[PLACEHOLDER] Real explanation goes here in Part 2.',
    },
    {
      field: 'kc_hawks_q1', type: 'mc', system: false,
      category: 'knowledge_check', format: 'multiple_choice',
      grading: 'static', correct_value: 'a', role_target: 'hawks',
      prompt: '[PLACEHOLDER] Sample question for Hawks role.',
      placeholder: '', order: 10, hidden: false, deletable: false,
      options: [
        { value: 'a', label: 'Option A (correct)' },
        { value: 'b', label: 'Option B' },
        { value: 'c', label: 'Option C' },
      ],
      explanation: '[PLACEHOLDER] Real explanation goes here in Part 2.',
    },
  ],

  // Legacy stub fields — must be present but content served via prepDefaults above
  content: {
    infoPDFs:      {} as Record<string, { private: string; public?: string }>,
    kcQuestions:   [],
    prepQuestions: [],
    scenarioText:  {},
  },
}
