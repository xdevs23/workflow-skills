import { describe, expect, test } from 'claude-code/testing'

import { QUESTION_SKILL, WITHDRAW_TOOL } from './names'
import { ALL_CLOSED } from './modelText'
import { SESSION_QUESTIONS_MAX_AGE_MS } from './questionSkill'
import { storeKeyOf } from './questionStore'
import {
  FIRST_SESSION,
  NO_TIME_LIMIT,
  SECOND_SESSION,
  answerByCommand,
  askAboutFriday,
  askWhichDatabase,
  callSkillTool,
  endTurn,
  listQuestions,
  mountBand,
  mountPane,
  questionCountOf,
  readFile,
  startProcess,
  startSession,
  startTurn,
  switchSession,
  typePrompt,
} from './testSupport'

const THIRD_SESSION = 'session-3'
const DAY_MS = 24 * 60 * 60 * 1000

describe('the questions of each session', () => {
  test(
    'a new session does not see the questions of another session, and counts its own from #1',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on)
      await askWhichDatabase($)
      await startProcess($, session, { id: SECOND_SESSION, source: 'startup' })
      await callSkillTool($, QUESTION_SKILL)
      const band = await mountBand($)

      expect(await band.find({ type: 'Text', text: /open question/ })).toBeUndefined()
      expect(await listQuestions($)).not.toContain('Which database?')
      expect(await answerByCommand($, '1 sqlite')).toBe('Question #1 is not open.')
      expect(String((await askAboutFriday($)).result)).toContain('#1')
      expect(questionCountOf(session)).toBe(1)
    },
  )

  test(
    'a session resumed after a restart shows its open questions and reads their answers',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on)
      await askWhichDatabase($)
      await startProcess($, session, { id: SECOND_SESSION, source: 'startup' })
      await startProcess($, session, { id: FIRST_SESSION, source: 'resume' })
      const band = await mountBand($)

      expect(await band.find({ type: 'Text', text: /^1 open question/ })).toBeDefined()
      await callSkillTool($, QUESTION_SKILL)
      await startTurn($)
      await answerByCommand($, '1 sqlite')
      expect((await readFile($)).context?.join('\n')).toContain('sqlite')
    },
  )

  test(
    'a session that /resume switched to uses the tools as itself',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on)
      await askWhichDatabase($)
      await switchSession($, session, { id: SECOND_SESSION, reason: 'resume' })
      await callSkillTool($, QUESTION_SKILL)

      expect(await listQuestions($)).not.toContain('Which database?')
      expect(String((await askAboutFriday($)).result)).toContain('#1')
      expect((await $.tool.call({ tool: WITHDRAW_TOOL, number: 1 })).deny).toBeUndefined()
      await switchSession($, session, { id: FIRST_SESSION, reason: 'resume' })
      const listed = await listQuestions($)
      expect(listed).toContain('#1: Which database?')
      expect(listed).not.toContain('Ship on Friday?')
    },
  )

  test(
    'a session that /clear switched to starts without the questions of the session before',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on)
      await askWhichDatabase($)
      await switchSession($, session, { id: SECOND_SESSION, reason: 'clear' })
      await callSkillTool($, QUESTION_SKILL)
      await startTurn($)

      expect(await answerByCommand($, '1 sqlite')).toBe('Question #1 is not open.')
      expect(await answerByCommand($, '')).toBe(ALL_CLOSED)
      expect((await readFile($)).context).toBeUndefined()
      expect(String((await askAboutFriday($)).result)).toContain('#1')
    },
  )

  test(
    'the first prompt typed after /resume switched back includes the answers given before',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on)
      await askWhichDatabase($)
      await startTurn($)
      await answerByCommand($, '1 sqlite')
      await endTurn($, { reason: 'aborted' })
      await switchSession($, session, { id: SECOND_SESSION, reason: 'resume' })
      await switchSession($, session, { id: FIRST_SESSION, reason: 'resume' })
      await typePrompt($, 'go on')

      expect(session.prompts).toHaveLength(1)
      expect(session.prompts[0]?.context?.join('\n')).toContain('sqlite')
    },
  )

  test(
    'the band and the pane of a session that /resume switched to start without the questions of ' +
      'the session before',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on)
      await askWhichDatabase($)
      await switchSession($, session, { id: SECOND_SESSION, reason: 'resume' })
      const band = await mountBand($)
      const pane = await mountPane($, 'terminal')

      expect(await band.find({ type: 'Text', text: /open question/ })).toBeUndefined()
      expect(await pane.find({ type: 'Text', text: ALL_CLOSED })).toBeDefined()
    },
  )

  test(
    'the band and the pane of a session that /resume switched back to show its open questions ' +
      'at once',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on)
      await askWhichDatabase($)
      await switchSession($, session, { id: SECOND_SESSION, reason: 'resume' })
      await switchSession($, session, { id: FIRST_SESSION, reason: 'resume' })
      const band = await mountBand($)
      const pane = await mountPane($, 'terminal')

      expect(await band.find({ type: 'Text', text: /^1 open question/ })).toBeDefined()
      expect(await pane.find({ type: 'Text', text: /Which database/ })).toBeDefined()
      await pane.input({ key: 'answer-1', text: 'sqlite' })
      expect(session.toasts).toEqual([])
      expect(await listQuestions($)).toContain('Answer: sqlite')
    },
  )

  test(
    'the band of a session that /clear switched to drops the open questions of the session ' +
      'before at once',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on, { isStateKept: true })
      await askWhichDatabase($)
      const band = await mountBand($)
      expect(await band.find({ type: 'Text', text: /^1 open question/ })).toBeDefined()
      await switchSession($, session, { id: SECOND_SESSION, reason: 'clear' })

      expect(await band.find({ type: 'Text', text: /open question/ })).toBeUndefined()
    },
  )

  test(
    'a store entry of another shape in a session that /resume switched to is shown in a toast',
    NO_TIME_LIMIT,
    async ($, on) => {
      const key = storeKeyOf(SECOND_SESSION, 'damaged')
      const session = await startSession($, on, {
        stored: new Map([[key, { questions: 'not a list' }]]),
      })
      await switchSession($, session, { id: SECOND_SESSION, reason: 'resume' })

      expect(session.toasts).toHaveLength(1)
      expect(session.toasts[0]).toContain(key)
    },
  )

  test(
    'a prompt typed after the questions could not be read at /resume reads them again and ' +
      'includes the answers',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on)
      await askWhichDatabase($)
      await startTurn($)
      await answerByCommand($, '1 sqlite')
      await endTurn($, { reason: 'aborted' })
      const damaged = storeKeyOf(FIRST_SESSION, 'damaged')
      session.store.set(damaged, { questions: 'not a list' })
      await switchSession($, session, { id: SECOND_SESSION, reason: 'resume' })
      await switchSession($, session, { id: FIRST_SESSION, reason: 'resume' })
      session.store.delete(damaged)
      await typePrompt($, 'go on')

      expect(session.toasts.join('\n')).toContain(damaged)
      expect(session.prompts[0]?.context?.join('\n')).toContain('sqlite')
    },
  )

  test(
    'the band of a session whose questions /resume could not read starts without the questions ' +
      'of the session before',
    NO_TIME_LIMIT,
    async ($, on) => {
      const damaged = storeKeyOf(SECOND_SESSION, 'damaged')
      const session = await startSession($, on, {
        stored: new Map([[damaged, { questions: 'not a list' }]]),
        isStateKept: true,
      })
      await askWhichDatabase($)
      await switchSession($, session, { id: SECOND_SESSION, reason: 'resume' })
      const band = await mountBand($)

      expect(session.toasts.join('\n')).toContain(damaged)
      expect(await band.find({ type: 'Text', text: /open question/ })).toBeUndefined()
    },
  )

  test(
    'an answer whose delivery starts after /clear is not sent to the session that /clear ' +
      'switched to, and is sent once its own session is back',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on, { isStateKept: true })
      await askWhichDatabase($)
      await answerByCommand($, '1 sqlite')
      await switchSession($, session, { id: SECOND_SESSION, reason: 'clear' })
      await callSkillTool($, QUESTION_SKILL)
      await askAboutFriday($)
      await session.clock.settle()
      const band = await mountBand($)

      expect(session.prompts).toEqual([])
      expect([...session.store.keys()].filter(key => key.startsWith('deliveries:'))).toEqual([])
      expect(await band.find({ type: 'Text', text: /^1 open question/ })).toBeDefined()
      await switchSession($, session, { id: FIRST_SESSION, reason: 'resume' })
      await typePrompt($, 'go on')
      expect(session.prompts[0]?.context?.join('\n')).toContain('sqlite')
    },
  )

  test(
    'a compaction keeps the questions in the band and does not read the store',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on)
      await askWhichDatabase($)
      session.store.set(storeKeyOf(FIRST_SESSION, 'damaged'), { questions: 'not a list' })
      await $.classic.SessionStart({ source: 'compact' })
      const band = await mountBand($)

      expect(session.toasts).toEqual([])
      expect(await band.find({ type: 'Text', text: /^1 open question/ })).toBeDefined()
    },
  )

  test(
    'questions saved under the project before they belonged to a session are moved to the ' +
      'session that asked them, with their answers',
    NO_TIME_LIMIT,
    async ($, on) => {
      const project = '0123456789abcdef'.repeat(4)
      const asked = { choices: [], sessionId: SECOND_SESSION }
      const session = await startSession($, on, {
        stored: new Map<string, unknown>([
          [
            `questions:${project}:q-answered`,
            { ...asked, id: 'q-answered', number: 1, text: 'Which database?', askedAt: 400 },
          ],
          [
            `questions:${project}:q-open`,
            { ...asked, id: 'q-open', number: 2, text: 'Ship on Friday?', askedAt: 500 },
          ],
          [`answers:${project}:q-answered:a-1`, { text: 'sqlite', answeredAt: 600 }],
          [`withdrawals:${project}:q-missing`, { withdrawnAt: 700 }],
        ]),
      })
      await startProcess($, session, { id: SECOND_SESSION, source: 'resume' })
      const band = await mountBand($)

      expect([...session.store.keys()].filter(key => key.includes(project))).toEqual([])
      expect(await band.find({ type: 'Text', text: /^1 open question/ })).toBeDefined()
      expect((await callSkillTool($, QUESTION_SKILL)).context?.join('\n')).toContain('sqlite')
      expect(String((await askWhichDatabase($)).result)).toContain('#3')
    },
  )

  test(
    'a load deletes the questions of another session once its newest record is older than the ' +
      'age limit',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on)
      await askWhichDatabase($)
      await session.clock.advance(DAY_MS)
      await answerByCommand($, '1 sqlite')
      await session.clock.settle()
      const recordsOfFirstSession = () =>
        [...session.store.keys()].filter(key => key.includes(`:${FIRST_SESSION}:`))
      session.id = SECOND_SESSION
      await session.clock.advance(SESSION_QUESTIONS_MAX_AGE_MS)
      await callSkillTool($, QUESTION_SKILL)
      expect(recordsOfFirstSession()).toHaveLength(3)
      await session.clock.advance(1)
      await callSkillTool($, QUESTION_SKILL)

      expect(recordsOfFirstSession()).toEqual([])
    },
  )

  test(
    'a load keeps the old questions of the session that loads, and of a session with a record ' +
      'of another shape',
    NO_TIME_LIMIT,
    async ($, on) => {
      const damaged = storeKeyOf(THIRD_SESSION, 'damaged')
      const session = await startSession($, on, {
        stored: new Map([[damaged, { questions: 'not a list' }]]),
      })
      await askWhichDatabase($)
      await session.clock.advance(SESSION_QUESTIONS_MAX_AGE_MS + 1)
      await callSkillTool($, QUESTION_SKILL)

      expect(questionCountOf(session)).toBe(1)
      expect(session.store.has(damaged)).toBe(true)
      expect(session.toasts).toEqual([])
    },
  )

  test(
    'a session forked from another starts without the questions of that session',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on, { isStateKept: true })
      await askWhichDatabase($)
      session.id = SECOND_SESSION
      await $.classic.SessionStart({ source: 'fork', session_id: SECOND_SESSION })
      const band = await mountBand($)

      expect(await band.find({ type: 'Text', text: /open question/ })).toBeUndefined()
      await callSkillTool($, QUESTION_SKILL)
      expect(await listQuestions($)).not.toContain('Which database?')
      expect(String((await askAboutFriday($)).result)).toContain('#1')
    },
  )
})
