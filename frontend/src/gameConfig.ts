import { type RoleConfig } from '@mygames/game-engine/roles'
import { type OutcomeField, type OutcomeSchema } from '@mygames/game-engine/outcome'

export type { RoleConfig, OutcomeField, OutcomeSchema }

export const hawksConfig: RoleConfig = {
  roles: [
    { key: 'angel', label: 'Angel', short: 'A' },
    { key: 'agent', label: 'Agent', short: 'G' },
    { key: 'hawks', label: 'Hawks', short: 'H' },
  ],
}

// Outcome schema — mirrors functions/src/gameDefinition.ts. Keys S/M/B match scoring.
export const hawksSchema: OutcomeSchema = [
  { key: 'S', type: 'decimal', min: 0, max: 20, step: 0.1  },  // base salary ($M)
  { key: 'M', type: 'decimal', min: 0, max: 1,  step: 0.01 },  // merch fraction (0–1)
  { key: 'B', type: 'decimal', min: 0, max: 20, step: 0.1  },  // championship bonus ($M)
]

export const FIELD_LABELS: Readonly<Record<string, string>> = {
  S: 'Base salary ($M)',
  M: 'Merchandising fraction (0–1)',
  B: 'Championship bonus ($M)',
}

export function formatField(field: OutcomeField, value: unknown): string {
  if (field.type === 'integer') return (value as number).toLocaleString('en-US')
  if (field.type === 'decimal') return (value as number).toLocaleString('en-US', { maximumFractionDigits: 2 })
  if (field.type === 'enum')    return value as string
  if (field.type === 'boolean') return (value as boolean) ? 'Yes' : 'No'
  return String(value)
}
