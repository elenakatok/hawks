import { onRequest } from 'firebase-functions/v2/https'
import * as admin from 'firebase-admin'
import {
  makeGetInstructorSession,
  makeAssignRole,
  makeCompletePrep,
  makeConfirmReady,
  makeGenerateAttendanceCode,
  makeVerifyAttendanceCode,
  makeGetRoster,
  makeSyncRoster,
  makeTriggerMatching,
  makeStartNegotiation,
  makeGetGroupMemberEmails,
  makeSubmitLeadOutcome,
  makeSubmitConfirmation,
  makeSubmitInstructorOutcome,
  makeFinalizeInstance,
  makePushResultsToClassroom,
  makeGetGameConfig,
  makeUpdateGameConfig,
  validateKCGate,
  makeGetStudentPrepQuestions,
  makeGetDebriefQuestions,
  makeSubmitKnowledgeCheck,
  makeSubmitStaticKnowledgeCheckQuestion,
  makeGetInfoUrls,
} from '@mygames/game-server'
import { hawksGameDef } from './gameDefinition'
import { buildStamp } from './buildInfo'

admin.initializeApp()

// ── KC gate validation (runs at cold start — loud failure if gate is misconfigured) ──
const _kcGateError = validateKCGate(
  hawksGameDef.roles.roles.map(r => r.key),
  hawksGameDef.prepDefaults ?? [],
)
if (_kcGateError) throw new Error(`Hawks KC gate validation failed: ${_kcGateError}`)

// ── Game endpoints (onCall, via game-server factories + Hawks definition) ─

export const getInstructorSession  = makeGetInstructorSession(hawksGameDef)
export const assignRole             = makeAssignRole(hawksGameDef)
export const completePrep           = makeCompletePrep(hawksGameDef)
export const confirmReady           = makeConfirmReady(hawksGameDef)
export const generateAttendanceCode = makeGenerateAttendanceCode(hawksGameDef)
export const verifyAttendanceCode   = makeVerifyAttendanceCode(hawksGameDef)
export const getRoster              = makeGetRoster(hawksGameDef)
export const syncRoster             = makeSyncRoster(hawksGameDef)
export const triggerMatching            = makeTriggerMatching(hawksGameDef)
export const startNegotiation           = makeStartNegotiation(hawksGameDef)
export const getGroupMemberEmails      = makeGetGroupMemberEmails(hawksGameDef)
export const submitLeadOutcome          = makeSubmitLeadOutcome(hawksGameDef)
export const submitConfirmation         = makeSubmitConfirmation(hawksGameDef)
export const submitInstructorOutcome    = makeSubmitInstructorOutcome(hawksGameDef)
export const finalizeInstance       = makeFinalizeInstance(hawksGameDef)
export const pushResultsToClassroom = makePushResultsToClassroom(hawksGameDef)
export const getGameConfig          = makeGetGameConfig(hawksGameDef)
export const updateGameConfig       = makeUpdateGameConfig(hawksGameDef)
export const getStudentPrepQuestions            = makeGetStudentPrepQuestions(hawksGameDef)
export const getDebriefQuestions                = makeGetDebriefQuestions(hawksGameDef)
export const submitKnowledgeCheck               = makeSubmitKnowledgeCheck(hawksGameDef)
export const submitStaticKnowledgeCheckQuestion = makeSubmitStaticKnowledgeCheckQuestion(hawksGameDef)
export const getInfoUrls                        = makeGetInfoUrls(hawksGameDef)
export { getReportData } from './getReportData'
export { updateGroupContract } from './updateGroupContract'
export { scoreAndRecord } from './scoreAndRecord'
// Instructor move / ungroup (classroom) — consumes shared makeMoveSeat via the negotiation
// adapter. See ./online. Additive: no other export or game is affected.
export { moveSeat } from './online'

// ── Non-game onRequest endpoints ──────────────────────────────────────────────

const CORS_ORIGINS = new Set(['https://hawks.mygames.live'])

export const health = onRequest((req, res) => {
  const origin = req.headers.origin ?? ''
  if (CORS_ORIGINS.has(origin)) {
    res.set('Access-Control-Allow-Origin', origin)
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.set('Vary', 'Origin')
  }
  if (req.method === 'OPTIONS') { res.status(204).send(''); return }
  res.json({ ok: true, game: 'hawks', build: buildStamp() })
})

// Emulator-only dev seed functions — onRequest, not game endpoints.
export { seedMatchTest, seedGroupForTest } from './seedFunctions'
