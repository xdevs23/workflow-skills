import { describe, expect, test } from 'claude-code/testing'
import type { ApiMessage } from 'claude-code'

import {
  ANSWER_COMMAND,
  ASK_TOOL,
  LIST_TOOL,
  PANE,
  PLUGIN,
  QUESTION_SKILL,
  WITHDRAW_TOOL,
} from './names'
import { describeQuestionSkillDenial } from './modelText'
import {
  QUESTION_SKILL_LOAD_MAX_AGE_MS,
  QUESTION_SKILL_MAX_TOKENS_AFTER_LOAD,
  QuestionSkillLoadState,
} from './questionSkill'
import { questionSkillLoadKeyOf, storeKeyOf } from './questionStore'
import {
  FIRST_SESSION,
  NO_TIME_LIMIT,
  SECOND_SESSION,
  TOKENS_AT_START,
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
  skillLoad,
  startSession,
  startTurn,
  toolCall,
  typePrompt,
} from './testSupport'
import type { Session } from './testSupport'

const LOCK_REFUSAL = 'Lock file is already being held'

/** The summary left by a compaction in place of the messages replaced by it. */
const COMPACTION_SUMMARY: ApiMessage = {
  role: 'user',
  content: [
    {
      type: 'text',
      text: 'This session is being continued from a previous conversation. Summary: work on the API.',
    },
  ],
}

/** A message that mentions the question skill without loading it. */
const QUESTION_SKILL_NAMED: ApiMessage = {
  role: 'user',
  content: [{ type: 'text', text: `Load ${QUESTION_SKILL} before you ask.` }],
}

/** Removes the load record of the session, as for a load never seen by the plugin. */
function forgetQuestionSkillLoad(session: Session) {
  session.store.delete(questionSkillLoadKeyOf(session.id))
}

function failedSkillLoad(skill: string): ApiMessage[] {
  return toolCall({ tool: 'Skill', input: { skill }, isFailed: true })
}

describe('asking without waiting', () => {
  for (const surface of ['terminal', 'desktop'] as const) {
    test(
      `an answer picked on the ${surface} while idle is sent to the model as a prompt`,
      NO_TIME_LIMIT,
      async ($, on) => {
        const session = await startSession($, on)
        expect((await askWhichDatabase($)).deny).toBeUndefined()
        const pane = await mountPane($, surface)
        await pane.select({ key: 'pick-1', value: 'sqlite' })
        await session.clock.settle()

        expect(session.prompts).toHaveLength(1)
        expect(session.prompts[0]?.text).toContain('sqlite')
        expect(session.prompts[0]?.origin).toMatchObject({ kind: 'plugin', asUser: true })
        expect((await readFile($)).context).toBeUndefined()
      },
    )
  }

  test(
    'an asked question is written into the chat history with its number and choices',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on)
      await askWhichDatabase($)
      await askAboutFriday($)

      expect(session.chatLines).toEqual([
        'Question #1 (choices: sqlite / postgres): Which database?',
        'Question #2: Ship on Friday?',
      ])
    },
  )

  test(
    'an answer given during a turn is added to the next tool result once',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on)
      await askWhichDatabase($)
      await startTurn($)
      await answerByCommand($, '1 postgres')

      expect((await readFile($)).context?.join('\n')).toContain('postgres')
      expect((await readFile($)).context).toBeUndefined()
      await endTurn($)
      await session.clock.settle()
      expect(session.prompts).toHaveLength(0)
    },
  )

  test(
    'an answer given during a turn that finishes without reading a tool result goes out when ' +
      'the turn ends',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on)
      await askWhichDatabase($)
      await startTurn($)
      const pane = await mountPane($, 'terminal')
      await pane.input({ key: 'answer-1', text: 'neither, keep the files' })
      await session.clock.settle()

      expect(session.prompts).toHaveLength(0)
      await endTurn($)
      await session.clock.settle()
      expect(session.prompts).toHaveLength(1)
      expect(session.prompts[0]?.text).toContain('neither, keep the files')
    },
  )

  test(
    'an answer given during a turn the user interrupts is sent with the next prompt of the user',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on)
      await askWhichDatabase($)
      await startTurn($)
      await answerByCommand($, '1 sqlite')
      await endTurn($, { reason: 'aborted' })
      await session.clock.settle()

      expect(session.prompts).toHaveLength(0)
      await typePrompt($, 'go on')
      expect(session.prompts).toHaveLength(1)
      expect(session.prompts[0]?.context?.join('\n')).toContain('sqlite')
      expect((await readFile($)).context).toBeUndefined()
    },
  )

  test(
    'an answer whose prompt the engine drops is added to the next tool result',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on)
      await askWhichDatabase($)
      session.droppedPrompt = 'a hook stopped it'
      await answerByCommand($, '1 sqlite')
      await session.clock.settle()

      expect(session.prompts).toHaveLength(1)
      expect(session.toasts.join('\n')).toContain('a hook stopped it')
      expect((await readFile($)).context?.join('\n')).toContain('sqlite')
    },
  )

  test(
    'a subagent reads no answer, and its turns leave the session idle',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on)
      await askWhichDatabase($)
      await startTurn($)
      await answerByCommand($, '1 postgres')

      expect((await readFile($, 'agent-1')).context).toBeUndefined()
      expect((await readFile($)).context?.join('\n')).toContain('postgres')
      await endTurn($)
      await startTurn($, 'agent-1')
      await askAboutFriday($)
      await answerByCommand($, '2 yes')
      await session.clock.settle()
      expect(session.prompts).toHaveLength(1)
      expect(session.prompts[0]?.text).toContain('yes')
    },
  )

  test(
    'the list contains open questions and answers, and the band opens the pane',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on)
      await askWhichDatabase($)
      await askAboutFriday($)
      const band = await mountBand($)
      await band.press({ key: 'answer' })
      await answerByCommand($, '#2 next week')
      await session.clock.settle()
      const listed = await listQuestions($)

      expect(session.panes).toEqual([PANE])
      expect(listed).toContain('Which database?')
      expect(listed).toContain('next week')
    },
  )

  test('the answer command lists, answers and explains its form', NO_TIME_LIMIT, async ($, on) => {
    const session = await startSession($, on)
    await askWhichDatabase($)

    const listed = await answerByCommand($, '')
    expect(listed).toContain('Which database?')
    expect(listed).toContain(`/${ANSWER_COMMAND} <number> <answer>`)
    expect(session.panes).toEqual([PANE])
    expect(await answerByCommand($, 'sqlite')).toContain(`/${ANSWER_COMMAND} <number>`)
    expect(await answerByCommand($, '9 sqlite')).toContain('#9')
    expect(await answerByCommand($, '9 sqlite')).not.toContain('Answered')
    expect(await answerByCommand($, '1 sqlite')).toContain('Answered')
    expect(await answerByCommand($, '1 postgres')).not.toContain('Answered')
  })

  test(
    'the pane on a surface without input fields still draws every question',
    NO_TIME_LIMIT,
    async ($, on) => {
      await startSession($, on)
      await askWhichDatabase($)
      const pane = await mountPane($, 'mobile')

      expect(await pane.find({ type: 'Text', text: /Which database/ })).toBeDefined()
    },
  )


  test(
    'a store that cannot be read makes the tools fail with the reason, which the debug log shows ' +
      'too',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on)
      const refusal = 'the store file is not readable'
      session.keysRefusal = refusal

      expect((await askWhichDatabase($)).deny).toContain(refusal)
      expect((await $.tool.call({ tool: LIST_TOOL })).deny).toContain(refusal)
      expect((await $.tool.call({ tool: WITHDRAW_TOOL, number: 1 })).deny).toContain(refusal)
      expect(await answerByCommand($, '')).toContain(refusal)
      expect(session.logs.filter(line => line.includes(refusal))).toHaveLength(4)
    },
  )

  test(
    'a withdrawn question is closed for the user and listed as withdrawn',
    NO_TIME_LIMIT,
    async ($, on) => {
      await startSession($, on)
      await askWhichDatabase($)
      await askAboutFriday($)

      expect((await $.tool.call({ tool: WITHDRAW_TOOL, number: 1 })).deny).toBeUndefined()
      expect((await $.tool.call({ tool: WITHDRAW_TOOL, number: 1 })).deny).toBeDefined()
      expect(await answerByCommand($, '')).not.toContain('Which database?')
      expect(await answerByCommand($, '1 sqlite')).not.toContain('Answered')
      expect(await listQuestions($)).toMatch(/Withdrawn questions:\n#1: Which database\?/)
      const band = await mountBand($)
      expect(await band.find({ type: 'Text', text: /^1 open question/ })).toBeDefined()
    },
  )

  test(
    'an answer given while the question is withdrawn is kept, and the withdrawal is denied',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on)
      await askWhichDatabase($)
      const questionPrefix = storeKeyOf(session.id, '')
      const questionKey = [...session.store.keys()].find(key => key.startsWith(questionPrefix))
      const answerKey = `answers:${questionKey?.slice('questions:'.length)}:given-elsewhere`
      session.beforeNextWrite = () =>
        session.store.set(answerKey, { text: 'sqlite', answeredAt: 1000 })

      expect((await $.tool.call({ tool: WITHDRAW_TOOL, number: 1 })).deny).toBeDefined()
      expect(await listQuestions($)).toMatch(/Answered questions:\n#1: Which database\?\nAnswer: sqlite/)
    },
  )

  test(
    'two questions asked at the same moment get different numbers',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on)
      session.beforeNextWrite = () =>
        session.store.set(storeKeyOf(session.id, 'asked-in-parallel'), {
          id: 'asked-in-parallel',
          number: 1,
          text: 'Keep the old API?',
          choices: [],
          askedAt: 900,
        })

      expect(String((await askWhichDatabase($)).result)).toContain('#2')
      const [first, second] = await Promise.all([askAboutFriday($), askAboutFriday($)])
      expect(new Set([String(first.result), String(second.result)]).size).toBe(2)
    },
  )

  test('a store busy with another write is written again', NO_TIME_LIMIT, async ($, on) => {
    const session = await startSession($, on)
    session.refusedWrites.push(LOCK_REFUSAL)
    const asking = askWhichDatabase($)
    await session.clock.settle()
    await session.clock.advance(60_000)

    expect((await asking).deny).toBeUndefined()
    expect(questionCountOf(session)).toBe(1)
    expect(session.toasts).toEqual([])
  })

  test('a write the store refuses is denied with its reason', NO_TIME_LIMIT, async ($, on) => {
    const session = await startSession($, on)
    session.refusedWrites.push('the store is over 4 MiB')

    expect((await askWhichDatabase($)).deny).toContain('the store is over 4 MiB')
    expect(questionCountOf(session)).toBe(0)
    expect(session.chatLines).toEqual([])
  })

  test('input the model gives outside the schema fails the check', NO_TIME_LIMIT, async ($, on) => {
    const session = await startSession($, on)

    expect((await $.tool.call({ tool: ASK_TOOL, question: '  ' })).deny).toBeDefined()
    expect(
      (await $.tool.call({ tool: ASK_TOOL, question: 'Pick?', choices: ['only'] })).deny,
    ).toBeDefined()
    expect(
      (await $.tool.call({ tool: ASK_TOOL, question: 'Pick?', choices: ['a', 'a'] })).deny,
    ).toBeDefined()
    expect(
      (await $.tool.call({ tool: ASK_TOOL, question: 'Pick?', choices: [] })).deny,
    ).toBeDefined()
    expect((await $.tool.call({ tool: WITHDRAW_TOOL, number: 0 })).deny).toBeDefined()
    expect(session.chatLines).toEqual([])
  })

  test(
    'a store entry of another shape fails the check and is left unchanged',
    NO_TIME_LIMIT,
    async ($, on) => {
      const key = storeKeyOf(FIRST_SESSION, 'damaged')
      const session = await startSession($, on, {
        stored: new Map([[key, { questions: 'not a list' }]]),
      })

      expect((await askWhichDatabase($)).deny).toContain(key)
      expect((await $.tool.call({ tool: LIST_TOOL })).deny).toContain(key)
      expect(session.store.get(key)).toEqual({ questions: 'not a list' })
      expect(questionCountOf(session)).toBe(1)
    },
  )

  test(
    'a session without a person at the prompt does not get the tools and does not read any ' +
      'question',
    NO_TIME_LIMIT,
    async ($, on) => {
      const key = storeKeyOf(FIRST_SESSION, 'damaged')
      const session = await startSession($, on, {
        stored: new Map([[key, { questions: 'not a list' }]]),
        isInteractive: false,
      })

      expect(session.registered).toEqual([])
      expect(session.toasts).toEqual([])
      expect((await askWhichDatabase($)).deny).toBeDefined()
      expect(questionCountOf(session)).toBe(1)
    },
  )
})

describe('asking with the question skill in context', () => {
  const NOT_RECORDED = describeQuestionSkillDenial({ state: QuestionSkillLoadState.NotRecorded })

  test(
    'a question asked by a session that has not loaded the question skill is denied and not ' +
      'stored',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on)
      session.context = []

      expect((await askWhichDatabase($)).deny).toBeDefined()
      expect(questionCountOf(session)).toBe(0)
      expect(session.chatLines).toEqual([])
    },
  )

  const notLoaded: [string, () => ApiMessage[]][] = [
    ['another skill loaded by the Skill tool', () => skillLoad(`${PLUGIN}:writing-style`)],
    ['a Skill tool call for the question skill that failed', () => failedSkillLoad(QUESTION_SKILL)],
    ['a message that mentions the question skill', () => [QUESTION_SKILL_NAMED]],
    [
      'another tool called with the name of the question skill',
      () => toolCall({ tool: 'Read', input: { skill: QUESTION_SKILL }, isFailed: false }),
    ],
    [
      'a Skill tool call for the question skill without its result',
      () =>
        toolCall({
          tool: 'Skill',
          input: { skill: QUESTION_SKILL },
          isFailed: false,
          resultOf: 'call-other',
        }),
    ],
  ]
  for (const [contains, context] of notLoaded) {
    test(
      `a question asked from a context with ${contains} is denied`,
      NO_TIME_LIMIT,
      async ($, on) => {
        const session = await startSession($, on)
        session.context = context()

        expect((await askWhichDatabase($)).deny).toBeDefined()
        expect(questionCountOf(session)).toBe(0)
      },
    )
  }

  test(
    'a question asked after a Skill tool call with spaces and a slash around the name is stored',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on)
      session.context = skillLoad(` /${QUESTION_SKILL} `)

      expect((await askWhichDatabase($)).deny).toBeUndefined()
      expect(questionCountOf(session)).toBe(1)
    },
  )

  test(
    'a question is denied once more tokens than the limit came into the context after the load ' +
      'of the question skill',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on)
      session.contextTokens = TOKENS_AT_START + QUESTION_SKILL_MAX_TOKENS_AFTER_LOAD
      expect((await askWhichDatabase($)).deny).toBeUndefined()
      session.contextTokens = TOKENS_AT_START + QUESTION_SKILL_MAX_TOKENS_AFTER_LOAD + 1

      expect((await askAboutFriday($)).deny).toBe(
        describeQuestionSkillDenial({
          state: QuestionSkillLoadState.OverLimit,
          tokensAfterLoad: QUESTION_SKILL_MAX_TOKENS_AFTER_LOAD + 1,
        }),
      )
      expect(questionCountOf(session)).toBe(1)
    },
  )

  test(
    'a question is denied when the plugin did not see a load of the question skill, although ' +
      'the context contains one',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on)
      forgetQuestionSkillLoad(session)

      expect((await askWhichDatabase($)).deny).toBe(NOT_RECORDED)
      expect(questionCountOf(session)).toBe(0)
    },
  )

  test(
    'a failed or denied Skill tool call, a load by a subagent and a load of another skill do ' +
      'not count as a load of the question skill',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on)
      forgetQuestionSkillLoad(session)
      session.isSkillFailing = true
      await callSkillTool($, QUESTION_SKILL)
      expect((await askWhichDatabase($)).deny).toBe(NOT_RECORDED)
      session.isSkillFailing = false
      session.isSkillDenied = true
      await callSkillTool($, QUESTION_SKILL)
      expect((await askWhichDatabase($)).deny).toBe(NOT_RECORDED)
      session.isSkillDenied = false
      await callSkillTool($, QUESTION_SKILL, 'agent-1')
      expect((await askWhichDatabase($)).deny).toBe(NOT_RECORDED)
      await callSkillTool($, `${PLUGIN}:writing-style`)

      expect((await askAboutFriday($)).deny).toBe(NOT_RECORDED)
      expect(questionCountOf(session)).toBe(0)
    },
  )

  test(
    'a question asked after the question skill was loaded again is stored',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on)
      session.contextTokens = 2 * (TOKENS_AT_START + QUESTION_SKILL_MAX_TOKENS_AFTER_LOAD)
      await callSkillTool($, ` /${QUESTION_SKILL}`)

      expect((await askWhichDatabase($)).deny).toBeUndefined()
      expect(questionCountOf(session)).toBe(1)
    },
  )

  test(
    'a load made while the engine does not report the context size removes the earlier record',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on)
      session.contextTokens = undefined
      await callSkillTool($, QUESTION_SKILL)
      expect(session.store.has(questionSkillLoadKeyOf(session.id))).toBe(false)
      session.contextTokens = TOKENS_AT_START

      expect((await askWhichDatabase($)).deny).toBe(NOT_RECORDED)
      expect(questionCountOf(session)).toBe(0)
    },
  )

  test(
    'a question asked while the engine does not report the context size is denied',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on)
      session.contextTokens = undefined

      expect((await askWhichDatabase($)).deny).toBe(
        describeQuestionSkillDenial({ state: QuestionSkillLoadState.NoContextSize }),
      )
      expect(questionCountOf(session)).toBe(0)
    },
  )

  test(
    'a question asked after a compaction kept the load in a smaller context is denied',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on)
      session.contextTokens = TOKENS_AT_START - 1

      expect((await askWhichDatabase($)).deny).toBe(NOT_RECORDED)
      expect(questionCountOf(session)).toBe(0)
    },
  )

  test(
    'a load record of another shape fails the check and is left unchanged',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on)
      const key = questionSkillLoadKeyOf(session.id)
      for (const damaged of [{ contextTokens: 'many', savedAt: 1000 }, { contextTokens: 1000 }]) {
        session.store.set(key, damaged)

        expect((await askWhichDatabase($)).deny).toContain(key)
        expect(session.store.get(key)).toEqual(damaged)
      }
      expect(questionCountOf(session)).toBe(0)
    },
  )

  test(
    'a load record the store refuses is shown with its reason, and the next question is denied',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on)
      forgetQuestionSkillLoad(session)
      session.refusedWrites.push('the store is over 4 MiB')
      await callSkillTool($, QUESTION_SKILL)

      expect(session.toasts).toHaveLength(1)
      expect(session.toasts[0]).toContain('the store is over 4 MiB')
      expect((await askWhichDatabase($)).deny).toBe(NOT_RECORDED)
    },
  )

  test(
    'a load deletes the load records of other sessions once they are older than the age limit',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on)
      const firstKey = questionSkillLoadKeyOf(session.id)
      session.id = SECOND_SESSION
      await session.clock.advance(QUESTION_SKILL_LOAD_MAX_AGE_MS)
      await callSkillTool($, QUESTION_SKILL)
      expect(session.store.has(firstKey)).toBe(true)
      await session.clock.advance(1)
      await callSkillTool($, QUESTION_SKILL)

      expect(session.store.has(firstKey)).toBe(false)
      expect(session.store.has(questionSkillLoadKeyOf(SECOND_SESSION))).toBe(true)
    },
  )

  test(
    'a question asked after a compaction removed the question skill from context is denied',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on)
      expect((await askWhichDatabase($)).deny).toBeUndefined()
      session.context = [COMPACTION_SUMMARY]

      expect((await askAboutFriday($)).deny).toBeDefined()
      expect(questionCountOf(session)).toBe(1)
    },
  )

  test(
    'a question asked by a subagent is stored without a check of the main conversation',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on)
      session.context = []

      expect((await askAboutFriday($, 'agent-1')).deny).toBeUndefined()
      expect(questionCountOf(session)).toBe(1)
    },
  )
})
