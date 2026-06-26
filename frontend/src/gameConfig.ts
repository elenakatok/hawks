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

// PLACEHOLDER outcome schema — mirrors functions/src/gameDefinition.ts; real fields in Part 3.
export const hawksSchema: OutcomeSchema = [
  { key: 'placeholder', type: 'integer', min: 0, max: 100 },
]

export const FIELD_LABELS: Readonly<Record<string, string>> = {
  placeholder: 'Placeholder',
}

export function formatField(field: OutcomeField, value: unknown): string {
  if (field.type === 'integer') return (value as number).toLocaleString('en-US')
  if (field.type === 'enum')    return value as string
  if (field.type === 'boolean') return (value as boolean) ? 'Yes' : 'No'
  return String(value)
}
