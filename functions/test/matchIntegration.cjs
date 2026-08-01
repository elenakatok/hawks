/* eslint-disable */
'use strict'

// ═══════════════════════════════════════════════════════════════════════════════
// HAWKS — matching integration test (the game's FIRST test; it previously had none).
//
// Seeds participants via seedMatchTest, calls triggerMatching, and verifies group
// formation for hawks' ASYMMETRIC 3-role composition { angel:1, agent:1, hawks:2 }
// (a base group is 1 Angel + 1 Agent + 2 Hawks = 4 seats).
//
// Requires the hawks emulator running with functions,firestore,database:
//   firebase emulators:start --only functions,firestore,database --project hawks-mygames-live
//   node test/matchIntegration.cjs
// ═══════════════════════════════════════════════════════════════════════════════

const BASE = 'http://localhost:5005/hawks-mygames-live/us-central1'
process.env.FIRESTORE_EMULATOR_HOST         = 'localhost:8082'
process.env.FIREBASE_DATABASE_EMULATOR_HOST = 'localhost:9002'

const admin = require('firebase-admin')
admin.initializeApp({ projectId: 'hawks-mygames-live', databaseURL: 'https://hawks-mygames-live-default-rtdb.firebaseio.com' })
const db = admin.firestore()

const ROLE_ARRAYS = { angel: 'angel_participants', agent: 'agent_participants', hawks: 'hawks_participants' }
let passed = 0, failed = 0
const ok = (label, cond, extra) => {
  if (cond) { console.log(`  [PASS] ${label}`); passed++ }
  else      { console.log(`  [FAIL] ${label}${extra !== undefined ? ` — ${extra}` : ''}`); failed++ }
}

async function post(path, body) {
  const r = await fetch(`${BASE}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: body }) })
  const j = await r.json()
  if (j.result !== undefined) return { status: r.status, body: j.result }
  if (j.error !== undefined) return { status: r.status, body: { ok: false, error: typeof j.error === 'string' ? j.error : (j.error.message ?? JSON.stringify(j.error)) } }
  return { status: r.status, body: j } // onRequest (seedMatchTest) returns flat JSON
}

function makeParticipants(nAngel, nAgent, nHawks) {
  const ps = []
  for (let i = 0; i < nAngel; i++) ps.push({ id: `angel${i + 1}`, role: 'angel' })
  for (let i = 0; i < nAgent; i++) ps.push({ id: `agent${i + 1}`, role: 'agent' })
  for (let i = 0; i < nHawks; i++) ps.push({ id: `hawks${i + 1}`, role: 'hawks' })
  return ps
}

async function readState(gameId) {
  const [gs, ps] = await Promise.all([
    db.collection('game_instances').doc(gameId).collection('groups').get(),
    db.collection('game_instances').doc(gameId).collection('participants').get(),
  ])
  return { groups: gs.docs.map(d => d.data()), participants: ps.docs.map(d => d.data()) }
}

async function testFormation(label, nAngel, nAgent, nHawks, expectedGroups) {
  const gameId = `hm_${label}_${Date.now()}`
  await post('/seedMatchTest', { game_instance_id: gameId, participants: makeParticipants(nAngel, nAgent, nHawks) })
  const res = await post('/triggerMatching', { _dev: { game_instance_id: gameId } })
  ok(`${label}: matching ok`, res.body.ok === true, res.body.error)

  const { groups, participants } = await readState(gameId)
  ok(`${label}: ${expectedGroups} group(s) formed`, groups.length === expectedGroups, groups.length)

  // Every participant appears in EXACTLY one group's role arrays.
  const pidToGroup = {}
  let dup = false
  for (const g of groups) {
    for (const arr of Object.values(ROLE_ARRAYS)) {
      for (const pid of (g[arr] || [])) { if (pidToGroup[pid]) dup = true; pidToGroup[pid] = g.group_id }
    }
  }
  ok(`${label}: no participant in two groups`, !dup)
  const placed = Object.keys(pidToGroup).length
  ok(`${label}: all ${expectedGroups * 4} matched participants placed`, placed === expectedGroups * 4, placed)

  // Each base group respects composition 1 angel + 1 agent + 2 hawks.
  const compositionOk = groups.every(g =>
    (g.angel_participants || []).length === 1 &&
    (g.agent_participants || []).length === 1 &&
    (g.hawks_participants || []).length === 2)
  ok(`${label}: every group is 1 angel + 1 agent + 2 hawks`, compositionOk,
    groups.map(g => `${(g.angel_participants||[]).length}/${(g.agent_participants||[]).length}/${(g.hawks_participants||[]).length}`).join(' '))

  // Lead is a real member; status matched; participant docs stamped.
  let leadOk = true, statusOk = true, stampOk = true, oneLeadOk = true
  for (const g of groups) {
    const members = Object.values(ROLE_ARRAYS).flatMap(a => g[a] || [])
    if (!members.includes(g.lead_participant_id)) leadOk = false
    if (g.status !== 'matched') statusOk = false
    for (const pid of members) {
      const p = participants.find(x => x.participant_id === pid)
      if (!p || p.group_id !== g.group_id) stampOk = false
    }
    const leads = members.filter(pid => (participants.find(x => x.participant_id === pid) || {}).is_lead === true)
    if (leads.length !== 1 || leads[0] !== g.lead_participant_id) oneLeadOk = false
  }
  ok(`${label}: lead is a member of its group`, leadOk)
  ok(`${label}: every group status = matched`, statusOk)
  ok(`${label}: each participant doc stamped with its group_id`, stampOk)
  ok(`${label}: exactly one is_lead per group, matching lead_participant_id`, oneLeadOk)
}

async function main() {
  console.log('\n── Hawks triggerMatching integration ──\n')
  // 1 base group: 1 angel + 1 agent + 2 hawks.
  await testFormation('1grp', 1, 1, 2, 1)
  // 2 base groups: 2/2/4.
  await testFormation('2grp', 2, 2, 4, 2)

  // Not enough of a role to form a base group → precondition error, no groups.
  console.log('\n  — negative: too few hawks (need 2 per group) —')
  const gameId = `hm_short_${Date.now()}`
  await post('/seedMatchTest', { game_instance_id: gameId, participants: makeParticipants(1, 1, 1) })
  const short = await post('/triggerMatching', { _dev: { game_instance_id: gameId } })
  ok('short roster rejected (needs 2 hawks)', short.body.ok !== true, `status ${short.status}`)
  const { groups } = await readState(gameId)
  ok('no groups written on rejection', groups.length === 0, groups.length)

  console.log(`\n── Summary: ${passed} passed, ${failed} failed ──`)
  process.exit(failed === 0 ? 0 : 1)
}

main().catch(err => { console.error('FATAL', err); process.exit(1) })
