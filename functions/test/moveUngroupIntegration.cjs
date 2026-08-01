/* eslint-disable */
'use strict'

// ═══════════════════════════════════════════════════════════════════════════════
// HAWKS — move / ungroup integration test (classroom Groups panel machinery).
//
// Exercises the real moveSeat / startNegotiation / assignRole callables for hawks'
// 3-role set (angel, agent, hawks): move between not-started groups (role preserved),
// ungroup (group stands, seat freed, No-Group pool), per-group lock (a started group is
// frozen in AND out while a not-started sibling still moves), and the role-timing back-fill
// (a role-less student placed then given a role appears in the correct role array).
//
// Requires the hawks emulator with functions,firestore,database,auth (assignRole/
// startNegotiation mint / need tokens):
//   firebase emulators:start --only functions,firestore,database,auth --project hawks-mygames-live
//   node test/moveUngroupIntegration.cjs
// ═══════════════════════════════════════════════════════════════════════════════

process.env.FIRESTORE_EMULATOR_HOST         = 'localhost:8082'
process.env.FIREBASE_DATABASE_EMULATOR_HOST = 'localhost:9002'
process.env.FIREBASE_AUTH_EMULATOR_HOST     = 'localhost:9101'

const admin = require('firebase-admin')
admin.initializeApp({ projectId: 'hawks-mygames-live', databaseURL: 'https://hawks-mygames-live-default-rtdb.firebaseio.com' })
const db = admin.firestore()
const BASE = 'http://localhost:5005/hawks-mygames-live/us-central1'
const ROLES = ['angel', 'agent', 'hawks']
const ROLE_ARRAYS = ROLES.map(r => `${r}_participants`)

let passed = 0, failed = 0
const ok = (l, c, x) => { if (c) { console.log(`  [PASS] ${l}`); passed++ } else { console.log(`  [FAIL] ${l}${x !== undefined ? ` — ${x}` : ''}`); failed++ } }

async function post(p, b) {
  const r = await fetch(`${BASE}${p}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: b }) })
  const j = await r.json(); let o
  if (j.result !== undefined) o = j.result
  else if (j.error !== undefined) o = { ok: false, error: typeof j.error === 'string' ? j.error : (j.error.message ?? '') }
  else o = j
  return { status: r.status, body: o }
}
const membersOf = g => ROLE_ARRAYS.flatMap(k => g[k] || [])
const gc = (gs, pid) => gs.filter(g => membersOf(g).includes(pid)).map(g => g.group_id)
const rg = async gid => (await db.collection('game_instances').doc(gid).collection('groups').get()).docs.map(d => d.data()).sort((a, b) => a.group_id.localeCompare(b.group_id))
const rp = async (gid, pid) => (await db.collection('game_instances').doc(gid).collection('participants').doc(pid).get()).data() ?? {}
const mv = (gid, pid, t) => post('/moveSeat', { _dev: { game_instance_id: gid }, participant_id: pid, target_group_id: t })
const seedParts = n => { const ps = []; for (const r of ROLES) { const c = r === 'hawks' ? n * 2 : n; for (let i = 1; i <= c; i++) ps.push({ id: `${r}${i}`, role: r }) } return ps }

async function main() {
  const gameId = `hmu_${Date.now()}`
  console.log(`\n══ Hawks move/ungroup + back-fill (${gameId}) ══`)
  // 3 base groups (3 angel, 3 agent, 6 hawks → 3× [1 angel + 1 agent + 2 hawks]).
  await post('/seedMatchTest', { game_instance_id: gameId, participants: seedParts(3) })
  const m = await post('/triggerMatching', { _dev: { game_instance_id: gameId } })
  ok('setup: matching ok', m.body.ok === true, m.body.error)
  let groups = await rg(gameId); ok('setup: 3 groups', groups.length === 3, groups.length)
  if (groups.length !== 3) { done(); return }
  let [A, B] = groups

  console.log('\n1. Move between not-started groups')
  const sH = A.hawks_participants[0]
  const r1 = await mv(gameId, sH, B.group_id); ok('move ok', r1.body.ok === true, r1.body.error)
  groups = await rg(gameId); A = groups.find(g => g.group_id === A.group_id); B = groups.find(g => g.group_id === B.group_id)
  const pH = await rp(gameId, sH)
  ok('group_id → B', pH.group_id === B.group_id)
  ok('exactly one group', gc(groups, sH).length === 1)
  ok('role PRESERVED in B hawks_participants only', B.hawks_participants.includes(sH) && !(B.angel_participants || []).includes(sH) && !(B.agent_participants || []).includes(sH))
  ok('participant role unchanged (hawks)', pH.role === 'hawks')

  console.log('\n2. Ungroup')
  const uAng = A.angel_participants[0]
  const r2 = await mv(gameId, uAng, ''); ok('ungroup ok', r2.body.ok === true, r2.body.error)
  groups = await rg(gameId); A = groups.find(g => g.group_id === A.group_id)
  ok('group_id null', (await rp(gameId, uAng)).group_id === null)
  ok('in no group array', gc(groups, uAng).length === 0)
  ok('A stands', A != null); ok('A angel seat freed', !(A.angel_participants || []).includes(uAng))

  console.log('\n3. Start B → lock (in+out); sibling C moves')
  const bM = B.hawks_participants[0]
  const st = await post('/startNegotiation', { _test: { participant_id: bM, game_instance_id: gameId } })
  ok('startNegotiation ok', st.body.ok === true, st.body.error)
  B = (await rg(gameId)).find(g => g.group_id === B.group_id)
  ok('B negotiating', B.status === 'negotiating' && B.negotiation_started_at != null)
  const out = await mv(gameId, membersOf(B)[0], A.group_id); ok('NEG: move OUT of started B rejected', out.body.ok !== true, `status ${out.status}`)
  const into = await mv(gameId, membersOf(A)[0], B.group_id); ok('NEG: move INTO started B rejected', into.body.ok !== true, `status ${into.status}`)
  const C = (await rg(gameId)).find(g => g.status === 'matched' && membersOf(g).length > 0 && g.group_id !== A.group_id)
  const sib = await mv(gameId, membersOf(C)[0], 'new'); ok('POS: not-started sibling C still moves', sib.body.ok === true, sib.body.error)

  console.log('\n4. Role-timing back-fill')
  await db.collection('game_instances').doc(gameId).collection('participants').doc('stephen').set({ participant_id: 'stephen', game_instance_id: gameId, name: 'Stephen' })
  const Acur = (await rg(gameId)).find(g => g.status === 'matched')
  const pl = await mv(gameId, 'stephen', Acur.group_id); ok('place role-less ok', pl.body.ok === true, pl.body.error)
  ok('BUG STATE: placed, group_id set, in no role array', (await rp(gameId, 'stephen')).group_id === Acur.group_id && gc(await rg(gameId), 'stephen').length === 0)
  const lg = await post('/assignRole', { _test: { participant_id: 'stephen', game_instance_id: gameId } })
  ok('assignRole ok', lg.body.ok === true, `${lg.status} ${lg.body.error ?? ''}`)
  const role = lg.body.role
  const g = (await rg(gameId)).find(x => x.group_id === Acur.group_id)
  ok('FIX: back-filled into the assigned role array', (g[`${role}_participants`] || []).includes('stephen'), `role=${role}`)
  ok('FIX: exactly one group', gc(await rg(gameId), 'stephen').length === 1)

  done()
}
function done() { console.log(`\n══ Summary: ${passed} passed, ${failed} failed ══`); process.exit(failed === 0 ? 0 : 1) }
main().catch(e => { console.error('FATAL', e); process.exit(1) })
