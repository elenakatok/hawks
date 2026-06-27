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

// ── Scoring (spec-locked; units $M) ──────────────────────────────────────────
// Outcome form fields: S (base salary 0–20), M (merch fraction 0–1), B (championship
// bonus 0–20). All three roles are value-sense (higher surplus = better); reservations
// are baked into the formulas. Walk-away / no-deal (null outcome) → surplus 0, stays
// in the scored pool. True no-show (raw null, z = −2) is handled by finalize, not here.
//   Angel surplus = 0.95·S + 8·M + 0.6·B − 2.205
//   Agent surplus = 0.05·S
//   Hawks surplus = 3 − 3·M − S − 0.1·B   (reservation 3 already baked in)

const ANGEL_RESERVATION = 2.205

// Round to the nearest $1,000 (3 decimals in $M): reproduces the locked conformance
// vector exactly and keeps stored scores clean; immaterial to the z-score distribution.
function round3(x: number): number {
  return Math.round(x * 1000) / 1000
}

export function computeScoreBreakdown(
  roleKey: string,
  outcome: Outcome | null,
  _configData?: Record<string, unknown>,
): { value_or_cost: number; raw_score: number } {
  // Walk-away / no-deal: zero surplus, stays in the scored pool.
  if (outcome === null) return { value_or_cost: 0, raw_score: 0 }

  const S = Number(outcome['S'] ?? 0)
  const M = Number(outcome['M'] ?? 0)
  const B = Number(outcome['B'] ?? 0)

  if (roleKey === 'angel') {
    const value = 0.95 * S + 8 * M + 0.6 * B
    return { value_or_cost: round3(value), raw_score: round3(value - ANGEL_RESERVATION) }
  }
  if (roleKey === 'agent') {
    const value = 0.05 * S
    return { value_or_cost: round3(value), raw_score: round3(value) }
  }
  if (roleKey === 'hawks') {
    // Realized cost to the Hawks; surplus = reservation (3) − cost.
    const cost = 3 * M + S + 0.1 * B
    return { value_or_cost: round3(cost), raw_score: round3(3 - cost) }
  }
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

  // ── prepDefaults: real Hawks KC content (Hawks_KC_Questions_v1.md) ────────
  // 3 roles × 9: Q1 role gate (ungraded), Q2–Q8 graded MC (denominator 7,
  // role-filtered), Q9 ungraded free-response reflection (prep phase).
  prepDefaults: [
    // ══ ROLE: angel (Angel Rocket — the player) ══════════════════════════════
    {
      field: 'kc_gate_angel', type: 'mc', system: true,
      category: 'knowledge_check', format: 'multiple_choice',
      grading: 'assigned_role', role_target: 'angel',
      prompt: 'What is your role in this negotiation?',
      placeholder: '', order: 0, hidden: false, deletable: false,
      options: [
        { value: 'angel', label: 'Angel Rocket — the star player negotiating her own contract with the Hawks' },
        { value: 'agent', label: "Angel Rocket's Agent — representing Angel and earning 5% of the salary negotiated" },
        { value: 'hawks', label: 'Hawks Management — the team negotiating to sign Angel' },
      ],
      explanation: 'You are Angel Rocket, the player. You and your agent are negotiating your contract with the Philadelphia Hawks.',
    },
    {
      field: 'kc_angel_reservation', type: 'mc', system: false,
      category: 'knowledge_check', format: 'multiple_choice',
      grading: 'static', correct_value: 'r_2_205m', role_target: 'angel',
      prompt: 'Your BATNA is to stay with the Kansas City Tornado. What is your reservation value in the negotiation with the Hawks, assuming all your compensation is in base salary?',
      placeholder: '', order: 10, hidden: false, deletable: false,
      options: [
        { value: 'r_2_5m',   label: '$2.5M' },
        { value: 'r_2_205m', label: '$2.205M' },
        { value: 'r_3m',     label: '$3M' },
        { value: 'r_2_1m',   label: '$2.1M' },
      ],
      explanation: 'Your reservation is the $2.1M you would earn next year by staying in Kansas City, grossed up by the 5% your agent takes on a Hawks salary. Since the agent earns nothing if you stay with the Tornado, you need the Hawks deal to cover both the $2.1M and that fee — $2.1M × 1.05 = $2.205M.',
    },
    {
      field: 'kc_angel_valuing_winning', type: 'mc', system: false,
      category: 'knowledge_check', format: 'multiple_choice',
      grading: 'static', correct_value: 'decrease', role_target: 'angel',
      prompt: 'If you place a value on winning a championship for its own sake, how would this change the reservation value entered in the last question?',
      placeholder: '', order: 11, hidden: false, deletable: false,
      options: [
        { value: 'increase',  label: 'Increase it.' },
        { value: 'no_change', label: 'No change.' },
        { value: 'decrease',  label: 'Decrease it.' },
      ],
      explanation: "Caring about winning means you'd accept less money to get it — you only truly value something if you'll give something up for it. So your monetary reservation goes down.",
    },
    {
      field: 'kc_angel_contract_value', type: 'mc', system: false,
      category: 'knowledge_check', format: 'multiple_choice',
      grading: 'static', correct_value: 'c_2_8m', role_target: 'angel',
      prompt: 'Assume you are risk neutral. Suppose you agree to a contract with a $2M base salary and a $1.5M bonus if the Hawks win the championship next year. What is the sum monetary value of this contract to you?',
      placeholder: '', order: 12, hidden: false, deletable: false,
      options: [
        { value: 'c_2_5m',  label: '$2.5M' },
        { value: 'c_3_5m',  label: '$3.5M' },
        { value: 'c_2_67m', label: '$2.67M' },
        { value: 'c_2_8m',  label: '$2.8M' },
      ],
      explanation: 'You keep 95% of the base salary (5% goes to your agent) and you discount the bonus by your own 60% estimate of winning. That is 0.95 × $2M + 0.60 × $1.5M = $1.9M + $0.9M = $2.8M.',
    },
    {
      field: 'kc_angel_merch', type: 'mc', system: false,
      category: 'knowledge_check', format: 'multiple_choice',
      grading: 'static', correct_value: 'm_3_6m', role_target: 'angel',
      prompt: 'Suppose that, in addition to the terms in the last question, you received 10% of merchandising. Now what is your sum compensation?',
      placeholder: '', order: 13, hidden: false, deletable: false,
      options: [
        { value: 'm_3_6m',  label: '$3.6M' },
        { value: 'm_3_45m', label: '$3.45M' },
        { value: 'm_3_8m',  label: '$3.8M' },
        { value: 'm_3m',    label: '$3M' },
      ],
      explanation: 'You believe merchandising profit is $10M with a championship and $5M without, and you put the chance of winning at 60%, so its expected value is 0.60 × $10M + 0.40 × $5M = $8M. Ten percent of that is $0.8M, added to the $2.8M from the prior contract = $3.6M.',
    },
    {
      field: 'kc_angel_nibble', type: 'mc', system: false,
      category: 'knowledge_check', format: 'multiple_choice',
      grading: 'static', correct_value: 'name_pattern', role_target: 'angel',
      prompt: "Suppose that, partway through the meeting, the other side starts raising a small new request every time you and your agent think you've settled the big issues — first a marketing appearance requirement, then a media-availability clause, then a relocation timeline. What is the most useful first response?",
      placeholder: '', order: 14, hidden: false, deletable: false,
      options: [
        { value: 'match',        label: 'Match the tactic by raising a few new requests of your own.' },
        { value: 'name_pattern', label: 'Name the pattern out loud and ask whether it makes sense to keep negotiating that way.' },
        { value: 'walk_out',     label: 'Walk out immediately, since this signals the other side is negotiating in bad faith.' },
        { value: 'agree_each',   label: "Agree to each small request as it comes so the main deal doesn't fall apart." },
      ],
      explanation: 'Naming the tactic explicitly is the recommended first step — before deciding whether and how to bargain over it. It keeps the focus on the merits of the deal and gives the other side a face-saving way to stop, rather than escalating, walking out, or quietly absorbing each new ask.',
    },
    {
      field: 'kc_angel_contingent', type: 'mc', system: false,
      category: 'knowledge_check', format: 'multiple_choice',
      grading: 'static', correct_value: 'contingent', role_target: 'angel',
      prompt: 'You have your own view of how likely the Hawks are to win a championship with you on board. Suppose it becomes clear in the meeting that the Hawks see that likelihood quite differently than you do. Rather than spend the meeting arguing over whose estimate is right, what approach would let each side act on its own view without requiring agreement on the number?',
      placeholder: '', order: 15, hidden: false, deletable: false,
      options: [
        { value: 'insist',     label: 'Insist the Hawks adopt your estimate before any contract terms are discussed.' },
        { value: 'average',    label: "Average your estimate with the Hawks' estimate and use that figure to set a flat salary." },
        { value: 'contingent', label: 'Ask for part of your pay to be contingent on whether the Hawks actually win the championship.' },
        { value: 'drop',       label: 'Drop the issue entirely and negotiate only on base salary.' },
      ],
      explanation: "A difference in expectations can be the basis of a deal rather than an obstacle. A championship-contingent bonus lets you act on your own confidence whatever the Hawks believe: if you're right, you earn more than a flat salary would have paid, and neither side has to win the probability argument up front.",
    },
    {
      field: 'kc_angel_principal_agent', type: 'mc', system: false,
      category: 'knowledge_check', format: 'multiple_choice',
      grading: 'static', correct_value: 'plan_divergence', role_target: 'angel',
      prompt: 'You will be represented in the room by your agent. Understanding the people you negotiate with — including your own agent — and their interests is one of the most useful things you can do before the meeting. Which of the following best reflects that principle here?',
      placeholder: '', order: 16, hidden: false, deletable: false,
      options: [
        { value: 'assume_reflects',      label: "Because your agent works for you, you can assume his advice in the room reflects your interests, so you don't need to give much thought to his ahead of time." },
        { value: 'plan_divergence',      label: "It is worth thinking about how your agent's interests may line up with yours on some terms and differ on others, so you can decide what guidance to give before and during the meeting." },
        { value: 'expect_self_interest', label: 'Since your agent is paid for his work, you should expect him to steer you toward whatever arrangement pays him best, and discount his advice accordingly.' },
        { value: 'final_say',            label: "Because you have the final say on signing, your agent's preferences won't really affect the outcome, so they aren't worth planning around." },
      ],
      explanation: 'Your agent may share your goals on some terms and weigh others differently, and thinking that through in advance helps you decide what instructions to give him. The other options each lean on one true fact — he works for you, he is paid, you have final say — to skip past the divergence a good principal actually plans around.',
    },
    {
      field: 'prep_angel_reflection', type: 'text', system: false,
      category: 'preparation', format: 'text', role_target: 'angel',
      prompt: 'If you end up signing a contract with a championship bonus instead of a larger flat salary, how would you want to explain that choice to a friend who only sees the lower guaranteed number?',
      placeholder: '', order: 20, hidden: false, deletable: true,
    },

    // ══ ROLE: agent (Angel Rocket's Agent) ═══════════════════════════════════
    {
      field: 'kc_gate_agent', type: 'mc', system: true,
      category: 'knowledge_check', format: 'multiple_choice',
      grading: 'assigned_role', role_target: 'agent',
      prompt: 'What is your role in this negotiation?',
      placeholder: '', order: 0, hidden: false, deletable: false,
      options: [
        { value: 'angel', label: 'Angel Rocket — the star player negotiating her own contract with the Hawks' },
        { value: 'agent', label: "Angel Rocket's Agent — representing Angel and earning 5% of the salary negotiated" },
        { value: 'hawks', label: 'Hawks Management — the team negotiating to sign Angel' },
      ],
      explanation: "You are Angel Rocket's Agent. You represent Angel in the negotiation with the Hawks and earn 5% of the salary you negotiate for her.",
    },
    {
      field: 'kc_agent_reservation', type: 'mc', system: false,
      category: 'knowledge_check', format: 'multiple_choice',
      grading: 'static', correct_value: 'r_2_205m', role_target: 'agent',
      prompt: "Angel's BATNA is to stay with the Kansas City Tornado. What is her reservation value in the negotiation with the Hawks, assuming all her compensation is in base salary?",
      placeholder: '', order: 10, hidden: false, deletable: false,
      options: [
        { value: 'r_2_5m',   label: '$2.5M' },
        { value: 'r_2_205m', label: '$2.205M' },
        { value: 'r_3m',     label: '$3M' },
        { value: 'r_2_1m',   label: '$2.1M' },
      ],
      explanation: "Angel's reservation is the $2.1M she would earn next year by staying in Kansas City, grossed up by the 5% fee you would need to be made whole on — because you receive nothing if she stays with the Tornado. That is $2.1M × 1.05 = $2.205M.",
    },
    {
      field: 'kc_agent_valuing_winning', type: 'mc', system: false,
      category: 'knowledge_check', format: 'multiple_choice',
      grading: 'static', correct_value: 'decrease', role_target: 'agent',
      prompt: 'If Angel places a value on winning a championship for its own sake, how would this change the reservation value entered in the last question?',
      placeholder: '', order: 11, hidden: false, deletable: false,
      options: [
        { value: 'increase',  label: 'Increase it.' },
        { value: 'no_change', label: 'No change.' },
        { value: 'decrease',  label: 'Decrease it.' },
      ],
      explanation: "Caring about winning means Angel would accept less money to get it — you only truly value something if you'll give something up for it. So her monetary reservation goes down.",
    },
    {
      field: 'kc_agent_contract_value', type: 'mc', system: false,
      category: 'knowledge_check', format: 'multiple_choice',
      grading: 'static', correct_value: 'c_2_8m', role_target: 'agent',
      prompt: 'Assume Angel is risk neutral. Suppose Angel agrees to a contract with a $2M base salary and a $1.5M bonus if the Hawks win the championship next year. What is the sum monetary value of this contract to Angel?',
      placeholder: '', order: 12, hidden: false, deletable: false,
      options: [
        { value: 'c_2_5m',  label: '$2.5M' },
        { value: 'c_3_5m',  label: '$3.5M' },
        { value: 'c_2_67m', label: '$2.67M' },
        { value: 'c_2_8m',  label: '$2.8M' },
      ],
      explanation: 'Angel keeps 95% of the base salary (5% goes to you) and discounts the bonus by her 60% estimate of winning. That is 0.95 × $2M + 0.60 × $1.5M = $1.9M + $0.9M = $2.8M.',
    },
    {
      field: 'kc_agent_merch', type: 'mc', system: false,
      category: 'knowledge_check', format: 'multiple_choice',
      grading: 'static', correct_value: 'm_3_6m', role_target: 'agent',
      prompt: 'Suppose that, in addition to the terms in the last question, Angel received 10% of merchandising. Now what is the sum compensation for Angel?',
      placeholder: '', order: 13, hidden: false, deletable: false,
      options: [
        { value: 'm_3_6m',  label: '$3.6M' },
        { value: 'm_3_45m', label: '$3.45M' },
        { value: 'm_3_8m',  label: '$3.8M' },
        { value: 'm_3m',    label: '$3M' },
      ],
      explanation: 'Angel believes merchandising profit is $10M with a championship and $5M without, and she puts the chance of winning at 60%, so its expected value is 0.60 × $10M + 0.40 × $5M = $8M. Ten percent of that is $0.8M, added to the $2.8M from the prior contract = $3.6M.',
    },
    {
      field: 'kc_agent_nibble', type: 'mc', system: false,
      category: 'knowledge_check', format: 'multiple_choice',
      grading: 'static', correct_value: 'name_pattern', role_target: 'agent',
      prompt: "Suppose that, partway through the meeting, the other side starts raising a small new request every time you and Angel think you've settled the big issues — first a marketing appearance requirement, then a media-availability clause, then a relocation timeline. What is the most useful first response?",
      placeholder: '', order: 14, hidden: false, deletable: false,
      options: [
        { value: 'match',        label: 'Match the tactic by raising a few new requests of your own.' },
        { value: 'name_pattern', label: 'Name the pattern out loud and ask whether it makes sense to keep negotiating that way.' },
        { value: 'walk_out',     label: 'Walk out immediately, since this signals the other side is negotiating in bad faith.' },
        { value: 'agree_each',   label: "Agree to each small request as it comes so the main deal doesn't fall apart." },
      ],
      explanation: 'Naming the tactic explicitly is the recommended first step — before deciding whether and how to bargain over it. It keeps the focus on the merits of the deal and gives the other side a face-saving way to stop, rather than escalating, walking out, or quietly absorbing each new ask.',
    },
    {
      field: 'kc_agent_contingent', type: 'mc', system: false,
      category: 'knowledge_check', format: 'multiple_choice',
      grading: 'static', correct_value: 'contingent', role_target: 'agent',
      prompt: 'Angel has her own view of how likely the Hawks are to win a championship, and you may or may not share it. Suppose it becomes clear in the meeting that the Hawks see that likelihood quite differently than Angel does. Rather than spend the meeting arguing over whose estimate is right, what approach would let each side act on its own view without requiring agreement on the number?',
      placeholder: '', order: 15, hidden: false, deletable: false,
      options: [
        { value: 'insist',     label: "Insist the Hawks adopt Angel's estimate before any contract terms are discussed." },
        { value: 'average',    label: "Average Angel's estimate with the Hawks' estimate and use that figure to set a flat salary." },
        { value: 'contingent', label: "Propose that part of Angel's pay be contingent on whether the Hawks actually win the championship." },
        { value: 'drop',       label: 'Drop the issue entirely and negotiate only on base salary.' },
      ],
      explanation: 'A difference in expectations can be the basis of a deal rather than an obstacle. A championship-contingent bonus lets each side act on its own belief: the more optimistic side accepts more contingent pay and the more skeptical side is comfortable offering it. Neither side has to win the probability argument up front.',
    },
    {
      field: 'kc_agent_principal_agent', type: 'mc', system: false,
      category: 'knowledge_check', format: 'multiple_choice',
      grading: 'static', correct_value: 'plan_divergence', role_target: 'agent',
      prompt: "You represent Angel in this negotiation. Being clear-eyed about how your own interests line up with your client's — where they align and where they may diverge — is part of representing her well. Which of the following best reflects that principle here?",
      placeholder: '', order: 16, hidden: false, deletable: false,
      options: [
        { value: 'assume_aligned',  label: "Because you were hired to advance Angel's interests, you can assume that what is good for you as her agent is good for her, and negotiate on that basis." },
        { value: 'plan_divergence', label: 'How a deal is structured can affect you and Angel differently, so it is worth thinking in advance about where your interests align with hers and where they might pull apart.' },
        { value: 'steer_expertise', label: "Since you carry the expertise in the room, you should steer the deal toward the structure you judge best and not let Angel's preferences complicate it." },
        { value: 'final_say',       label: "Because Angel has the final say on whether to sign, any divergence between your interests and hers will sort itself out, so it isn't worth examining closely." },
      ],
      explanation: 'Different contract structures can affect an agent and a client differently, and recognizing where those interests align and diverge is part of representing the client well. The other options each anchor on a real feature of the role — you serve her, you bring expertise, she holds final say — but each uses that feature to skip past the divergence a good agent examines.',
    },
    {
      field: 'prep_agent_reflection', type: 'text', system: false,
      category: 'preparation', format: 'text', role_target: 'agent',
      prompt: "Where exactly do your interests and Angel's interests come apart in this negotiation, and what, if anything, do you intend to do about it?",
      placeholder: '', order: 20, hidden: false, deletable: true,
    },

    // ══ ROLE: hawks (Hawks Management) ════════════════════════════════════════
    {
      field: 'kc_gate_hawks', type: 'mc', system: true,
      category: 'knowledge_check', format: 'multiple_choice',
      grading: 'assigned_role', role_target: 'hawks',
      prompt: 'What is your role in this negotiation?',
      placeholder: '', order: 0, hidden: false, deletable: false,
      options: [
        { value: 'angel', label: 'Angel Rocket — the star player negotiating her own contract with the Hawks' },
        { value: 'agent', label: "Angel Rocket's Agent — representing Angel and earning 5% of the salary negotiated" },
        { value: 'hawks', label: 'Hawks Management — the team negotiating to sign Angel' },
      ],
      explanation: 'You are Hawks Management. You are negotiating to sign Angel Rocket to replace your retiring center, Cindy Hooper.',
    },
    {
      field: 'kc_hawks_reservation', type: 'mc', system: false,
      category: 'knowledge_check', format: 'multiple_choice',
      grading: 'static', correct_value: 'r_3m', role_target: 'hawks',
      prompt: "The Hawks' BATNA is to keep Cindy Hooper under contract. What is the Hawks' reservation value in the negotiation with Angel Rocket?",
      placeholder: '', order: 10, hidden: false, deletable: false,
      options: [
        { value: 'r_2m',    label: '$2M' },
        { value: 'r_3m',    label: '$3M' },
        { value: 'r_2_5m',  label: '$2.5M' },
        { value: 'r_3_25m', label: '$3.25M' },
      ],
      explanation: "Angel would replace Cindy Hooper, who costs $2M, and the Hawks think Angel is worth about $1M more — that extra $1M being the expected value of additional merchandising. With Angel, merchandising profit is $12M on a championship and $2M otherwise, and the Hawks put the championship chance at 10%, so its expected value is 0.10 × $12M + 0.90 × $2M = $3M, which is $1M above Cindy's $2M baseline.",
    },
    {
      field: 'kc_hawks_valuing_winning', type: 'mc', system: false,
      category: 'knowledge_check', format: 'multiple_choice',
      grading: 'static', correct_value: 'increase', role_target: 'hawks',
      prompt: 'If the Hawks place a value on winning a championship for its own sake, how would this change the reservation value entered in the last question?',
      placeholder: '', order: 11, hidden: false, deletable: false,
      options: [
        { value: 'increase',  label: 'Increase it.' },
        { value: 'no_change', label: 'No change.' },
        { value: 'decrease',  label: 'Decrease it.' },
      ],
      explanation: "Caring about winning means the Hawks would pay more to get it — you only truly value something if you'll give something up for it. So their reservation goes up.",
    },
    {
      field: 'kc_hawks_contract_cost', type: 'mc', system: false,
      category: 'knowledge_check', format: 'multiple_choice',
      grading: 'static', correct_value: 'c_2_15m', role_target: 'hawks',
      prompt: 'Assume the Hawks are risk neutral. Suppose the Hawks agree to a contract with a $2M base salary and a $1.5M bonus if the Hawks win the championship next year. What is the sum monetary cost of this contract to the Hawks?',
      placeholder: '', order: 12, hidden: false, deletable: false,
      options: [
        { value: 'c_2m',    label: '$2M' },
        { value: 'c_2_15m', label: '$2.15M' },
        { value: 'c_3_35m', label: '$3.35M' },
        { value: 'c_2_8m',  label: '$2.8M' },
      ],
      explanation: 'The Hawks discount the bonus by their own 10% estimate of winning, so the cost is $2M base + 0.10 × $1.5M = $2M + $0.15M = $2.15M.',
    },
    {
      field: 'kc_hawks_merch', type: 'mc', system: false,
      category: 'knowledge_check', format: 'multiple_choice',
      grading: 'static', correct_value: 'm_2_45m', role_target: 'hawks',
      prompt: 'Suppose that, in addition to the terms in the last question, Angel received 10% of merchandising. Now what is the sum compensation cost to the Hawks?',
      placeholder: '', order: 13, hidden: false, deletable: false,
      options: [
        { value: 'm_2_45m', label: '$2.45M' },
        { value: 'm_3_45m', label: '$3.45M' },
        { value: 'm_3_35m', label: '$3.35M' },
        { value: 'm_3m',    label: '$3M' },
      ],
      explanation: "The Hawks estimate merchandising profit at $12M with a championship and $2M without, and put the championship chance at 10%, so its expected value is 0.10 × $12M + 0.90 × $2M = $3M. Angel's 10% of that is $0.3M, added to the $2.15M from the prior contract = $2.45M.",
    },
    {
      field: 'kc_hawks_nibble', type: 'mc', system: false,
      category: 'knowledge_check', format: 'multiple_choice',
      grading: 'static', correct_value: 'name_pattern', role_target: 'hawks',
      prompt: 'Hawks management is wary of letting a difficult session run long, since fatigue and irritation can lead either side to make moves it later regrets. Suppose the other side starts repeatedly raising small new demands every time the Hawks think they have reached agreement on the big issues. What is the most useful first response for Hawks management?',
      placeholder: '', order: 14, hidden: false, deletable: false,
      options: [
        { value: 'match',         label: 'Match the tactic by raising a few new demands of your own before the next session.' },
        { value: 'name_pattern',  label: 'Name the pattern out loud and ask whether it makes sense to keep negotiating that way.' },
        { value: 'refuse_written', label: 'Refuse to discuss anything further until the other side commits to a final list in writing.' },
        { value: 'concede_small', label: 'Quietly concede the small items so the bigger issues stay on track.' },
      ],
      explanation: 'Naming the tactic explicitly is the recommended first step — before deciding whether and how to bargain over it. It keeps the focus on the merits of the deal and gives the other side a face-saving way to stop, rather than escalating, stonewalling, or quietly absorbing each new demand.',
    },
    {
      field: 'kc_hawks_contingent', type: 'mc', system: false,
      category: 'knowledge_check', format: 'multiple_choice',
      grading: 'static', correct_value: 'contingent', role_target: 'hawks',
      prompt: 'The Hawks have their own view of how likely a championship is next year with Angel on board. Suppose it becomes clear in the meeting that the other side sees that likelihood quite differently than the Hawks do. Rather than spend the meeting arguing over whose estimate is right, what approach would let each side act on its own view without requiring agreement on the number?',
      placeholder: '', order: 15, hidden: false, deletable: false,
      options: [
        { value: 'average',    label: 'Average the two estimates and use that figure to set a flat salary.' },
        { value: 'insist',     label: "Insist the Hawks' estimate is correct, since they have more information about their own roster." },
        { value: 'contingent', label: "Tie part of Angel's pay to whether the Hawks actually win the championship." },
        { value: 'postpone',   label: 'Postpone the salary discussion until after the season, once the outcome is known.' },
      ],
      explanation: 'A difference in expectations can be the basis of a deal rather than an obstacle. Tying compensation to whether the championship is actually won lets each side bet on its own belief: the more optimistic side accepts more contingent pay and the more skeptical side is comfortable offering it. Neither side has to concede the argument up front.',
    },
    {
      field: 'kc_hawks_read_player_agent', type: 'mc', system: false,
      category: 'knowledge_check', format: 'multiple_choice',
      grading: 'static', correct_value: 'plan_divergence', role_target: 'hawks',
      prompt: 'Angel will be represented in the room by an agent. Understanding the people across the table — their interests, incentives, and constraints — is one of the most useful things a negotiator can do. Which of the following best reflects that principle for the Hawks here?',
      placeholder: '', order: 16, hidden: false, deletable: false,
      options: [
        { value: 'agent_equals_angel',  label: "Since the agent's job is to serve Angel, the Hawks can treat anything the agent pushes for as a direct read on what Angel herself wants." },
        { value: 'plan_divergence',     label: 'The Hawks should watch for places where Angel and her agent might weigh a term differently, since the two need not value every part of the deal the same way.' },
        { value: 'expect_self_interest', label: 'Because the agent is a paid professional, the Hawks should expect him to favor whatever structure maximizes his own compensation, and plan around that.' },
        { value: 'final_say',           label: 'Since Angel has the final say on signing, the Hawks should focus on persuading her and treat the agent mainly as a messenger.' },
      ],
      explanation: 'A player and an agent need not value every term identically, and staying alert to that gap helps the Hawks anticipate which proposals gain traction. The other options are each half-true — the agent does serve Angel, is a paid professional, and Angel does have final say — but each collapses a subtle relationship into a single assumption that could mislead the Hawks about who wants what.',
    },
    {
      field: 'prep_hawks_reflection', type: 'text', system: false,
      category: 'preparation', format: 'text', role_target: 'hawks',
      prompt: "If the Hawks end up offering a contract with a championship bonus, how would you want to defend that structure if a reporter or a skeptical Hawks investor asked why the team didn't just pay a flat salary?",
      placeholder: '', order: 20, hidden: false, deletable: true,
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
