import { describe, expect } from 'claude-code/testing'
import type { Engine, FoundElement, MountInputTarget } from 'claude-code/testing'

import { cardKeyedIn, shownTextsIn } from '../cardFieldsTestSupport'
import { test } from '../testDeclaration'
import type { Cadence } from '../../types'
import { EVERY_EVENT } from '../everyEvent'
import { NO_FOCUS_IN_KIT } from '../goals/goalPaneTestSupport'
import { FIRST_SESSION, mountPane, startSession } from '../testSupport'
import type { Session } from '../testSupport'
import { isListField } from './cadenceKind'
import { PHRASE_KIND } from './phraseCadence'
import { REMINDERS_COMMAND, REMINDERS_PANE } from './reminderNames'
import {
  cadenceRecordOf,
  enabledRecordOf,
  reminderRecordOf,
  remindersPrefixOf,
  removalRecordOf,
  textRecordOf,
} from './reminderRecord'
import { REMOVE_ITEM_MARK, TEXT_LABEL, describeRemoveItem } from './reminderTexts'
import { TIME_KIND, TimeUnit } from './timeKind'

const MARK_GOAL = 'Mark the goal done with its evidence when you finish testing.'
const START_BUILD = "Start a build whenever it's ready."
const CHECK_CI = 'Check the CI run of PR #318 and fix what fails.'
const UPDATE_SPEC = 'Update .cache/specs/login-fix.md with what is done.'

/** The time of the mock clock of the test session, at which every change of a test is saved. */
const NOW = 1000

const FULL_STORE = 'the store is over 4 MiB'

/**
 * The cadence of every reminder of the tests. The kind "when Claude says" is the first in the kind
 * dropdown, so a new card starts with it and is saved once its phrase is typed.
 */
const PHRASE = 'tests pass'
const SAYS_TESTS_PASS: Cadence = { kind: PHRASE_KIND.id, values: { phrases: [PHRASE] } }

/**
 * The labels of the fields that add a phrase, drawn under a card of the kind "when Claude says".
 */
const PHRASE_FIELD_LABELS = PHRASE_KIND.fields.filter(isListField).map(field => field.label)

/**
 * What a card of the kind "when Claude says", the Box keyed `cardKey`, is drawn beside while it is
 * edited: its text field and the fields that add a phrase, each after the label of its field.
 */
function layoutOfEditedPhraseCard(cardKey: string) {
  return {
    props: { flexDirection: 'column' },
    children: [
      { type: 'Box', props: { key: cardKey } },
      { type: 'Input', props: { label: TEXT_LABEL } },
      ...PHRASE_FIELD_LABELS.map(label => ({ type: 'Input', props: { label } })),
    ],
  }
}

/**
 * The records of reminders 1 and 2 of FIRST_SESSION, with reminder 1 switched on and reminder 2
 * never switched, and of reminder 3, which is removed. The tests tell whether a card is on by
 * comparing its switch with the switch of reminder 1 or 2.
 */
function storedReminders(): Map<string, unknown> {
  const records = [
    reminderRecordOf(FIRST_SESSION, {
      id: 'mark-goal',
      number: 1,
      text: MARK_GOAL,
      addedAt: 100,
      cadence: SAYS_TESTS_PASS,
    }),
    reminderRecordOf(FIRST_SESSION, {
      id: 'start-build',
      number: 2,
      text: START_BUILD,
      addedAt: 200,
      cadence: SAYS_TESTS_PASS,
    }),
    reminderRecordOf(FIRST_SESSION, {
      id: 'check-ci',
      number: 3,
      text: CHECK_CI,
      addedAt: 300,
      cadence: SAYS_TESTS_PASS,
    }),
    enabledRecordOf(FIRST_SESSION, 'mark-goal', true, 110),
    removalRecordOf(FIRST_SESSION, 'check-ci', 400),
  ]

  return new Map(records.map(record => [record.key, record.value]))
}

/** The records of reminders in the store of the session, leaving out the other records. */
function reminderRecordsOf(session: Session): Map<string, unknown> {
  const prefix = remindersPrefixOf(session.id)

  return new Map([...session.store].filter(([key]) => key.startsWith(prefix)))
}

/**
 * The id of the one reminder the test added to the records of `storedReminders`: the rest of the
 * key of its first record, which names no part.
 */
function addedIdOf(session: Session): string {
  const prefix = remindersPrefixOf(session.id)
  const added = [...reminderRecordsOf(session).keys()]
    .filter(key => !storedReminders().has(key))
    .map(key => key.slice(prefix.length))
    .filter(rest => !rest.includes(':'))
  expect(added).toHaveLength(1)

  return added[0] ?? ''
}

function mountRemindersPane<Surface extends 'terminal' | 'mobile'>($: Engine, surface: Surface) {
  return mountPane($, surface, REMINDERS_PANE)
}

type RemindersPane = Awaited<ReturnType<typeof mountRemindersPane<'terminal'>>>

/** The label of the switch of the card numbered `number`. */
async function switchOf(
  pane: Pick<RemindersPane, 'find'>,
  number: number,
): Promise<unknown> {
  return (await pane.find({ key: `switch-${number}` }))?.props.label
}

/** The texts the pane draws as warnings. */
async function warningsOf(pane: Pick<RemindersPane, 'findAll'>): Promise<string[]> {
  const texts = await pane.findAll({ type: 'Text' })

  return texts.filter(text => text.props.color === 'warning').map(({ text }) => text)
}

/** The texts drawn by the pane. */
async function textsOf(pane: Pick<RemindersPane, 'findAll'>): Promise<string[]> {
  return (await pane.findAll({ type: 'Text' })).map(({ text }) => text)
}

/**
 * The text field of the card edited in the pane: the first Input drawn. Its key changes with every
 * opening of the card.
 */
async function textFieldOf(pane: Pick<RemindersPane, 'find'>): Promise<FoundElement | undefined> {
  return pane.find({ type: 'Input' })
}

/** The key of the kind dropdown of the card edited in the pane: the first dropdown drawn. */
async function kindDropdownOf(pane: Pick<RemindersPane, 'find'>): Promise<string> {
  const key = (await pane.find({ type: 'Select' }))?.key
  if (key === undefined) {
    throw new Error('The pane draws no card with a kind dropdown.')
  }

  return key
}

/** Types `text` into the text field of the card edited in the pane, as the input `kind`. */
async function typeIntoCard(
  pane: RemindersPane,
  text: string,
  kind: NonNullable<MountInputTarget['kind']>,
): Promise<void> {
  const key = (await textFieldOf(pane))?.key
  if (key === undefined) {
    throw new Error('The pane draws no card with a text field.')
  }
  await pane.input({ key, text, kind })
}

/**
 * Types `phrase` into the field that adds a phrase to the card edited in the pane, the Input after
 * its text, as the input `kind`.
 */
async function typePhrase(
  pane: RemindersPane,
  phrase: string,
  kind: NonNullable<MountInputTarget['kind']>,
): Promise<void> {
  const [, phraseField] = await pane.findAll({ type: 'Input' })
  if (phraseField?.key === undefined) {
    throw new Error('The pane draws no card with a phrases field.')
  }
  await pane.input({ key: phraseField.key, text: phrase, kind })
}

/**
 * Types `phrase` with an Enter into the field that adds a phrase to the card edited in the pane.
 * The Enter rejects with `NO_FOCUS_IN_KIT` after the phrase is added.
 */
async function addPhrase(pane: RemindersPane, phrase: string): Promise<void> {
  await expect(typePhrase(pane, phrase, 'submit')).rejects.toThrow(NO_FOCUS_IN_KIT)
}

/** Presses + Add reminder and types `text` and PHRASE into the new card, without an Enter. */
async function addCard(pane: RemindersPane, text: string): Promise<void> {
  await expect(pane.press({ key: 'add-reminder' })).rejects.toThrow(NO_FOCUS_IN_KIT)
  await typeIntoCard(pane, text, 'change')
  await typePhrase(pane, PHRASE, 'change')
}

/** The button that removes the phrase `phrase` from the card edited in the pane. */
async function removePhraseButtonOf(
  pane: Pick<RemindersPane, 'findAll'>,
  phrase: string,
): Promise<FoundElement | undefined> {
  const buttons = await pane.findAll({ type: 'Button' })

  return buttons.find(button => button.props.label === describeRemoveItem(phrase))
}

/**
 * The records of storedReminders, with reminder 1 on `phrases`, as an earlier version stored them.
 */
function storedWithPhrasesOfReminder1(phrases: string): Map<string, unknown> {
  const reminder1 = reminderRecordOf(FIRST_SESSION, {
    id: 'mark-goal',
    number: 1,
    text: MARK_GOAL,
    addedAt: 100,
    cadence: { kind: PHRASE_KIND.id, values: { phrases } },
  })

  return storedReminders().set(reminder1.key, reminder1.value)
}

describe('the Reminders pane', () => {
  test(
    '/reminders opens the pane on every reminder not removed, a reminder never switched is off',
    async ($, on) => {
      const session = await startSession($, on, { stored: storedReminders() })
      const ran = await $.command.run({
        command: REMINDERS_COMMAND,
        args: '',
        origin: { kind: 'composer' },
        presentation: { isFullscreen: true, columns: 120 },
      })

      expect(ran.text).toBeUndefined()
      expect(session.panes).toEqual([REMINDERS_PANE])
      const pane = await mountRemindersPane($, 'terminal')
      expect(await pane.find({ type: 'Text', text: MARK_GOAL })).toBeDefined()
      expect(await pane.find({ type: 'Text', text: START_BUILD })).toBeDefined()
      expect(await pane.find({ type: 'Text', text: CHECK_CI })).toBeUndefined()
      expect(await switchOf(pane, 1)).not.toBe(await switchOf(pane, 2))
      expect(await pane.find({ key: 'edit-2' })).toBeDefined()
      expect(await pane.find({ key: 'switch-3' })).toBeUndefined()
    },
  )

  test(
    '+ Add draws an empty card that is off, numbered after every reminder added, removed or not',
    async ($, on) => {
      const session = await startSession($, on, { stored: storedReminders() })
      const pane = await mountRemindersPane($, 'terminal')
      await expect(pane.press({ key: 'add-reminder' })).rejects.toThrow(NO_FOCUS_IN_KIT)

      expect((await textFieldOf(pane))?.props.value).toBe('')
      expect(await switchOf(pane, 4)).toBe(await switchOf(pane, 2))
      expect(await pane.find({ key: 'add-reminder' })).toBeUndefined()
      expect(reminderRecordsOf(session)).toEqual(storedReminders())
    },
  )

  test(
    'Done on a new card stores the reminder off, and draws its card with its buttons',
    async ($, on) => {
      const session = await startSession($, on, { stored: storedReminders() })
      const pane = await mountRemindersPane($, 'terminal')
      await addCard(pane, `  ${UPDATE_SPEC}  `)
      await pane.press({ key: 'done-4' })

      const added = reminderRecordOf(FIRST_SESSION, {
        id: addedIdOf(session),
        number: 4,
        text: UPDATE_SPEC,
        addedAt: NOW,
        cadence: SAYS_TESTS_PASS,
      })
      expect(reminderRecordsOf(session)).toEqual(storedReminders().set(added.key, added.value))
      expect(await textFieldOf(pane)).toBeUndefined()
      expect(await pane.find({ type: 'Text', text: UPDATE_SPEC })).toBeDefined()
      expect(await switchOf(pane, 4)).toBe(await switchOf(pane, 2))
      expect(await pane.find({ key: 'edit-4' })).toBeDefined()
      expect(await pane.find({ key: 'add-reminder' })).toBeDefined()
    },
  )

  test(
    'the switch of a new card stores the reminder switched on, and the card is still drawn with ' +
      'its fields',
    async ($, on) => {
      const session = await startSession($, on, { stored: storedReminders() })
      const pane = await mountRemindersPane($, 'terminal')
      await addCard(pane, UPDATE_SPEC)
      await pane.press({ key: 'switch-4' })

      const id = addedIdOf(session)
      const added = reminderRecordOf(FIRST_SESSION, {
        id,
        number: 4,
        text: UPDATE_SPEC,
        addedAt: NOW,
        cadence: SAYS_TESTS_PASS,
      })
      const enabled = enabledRecordOf(FIRST_SESSION, id, true, NOW)
      expect(reminderRecordsOf(session)).toEqual(
        storedReminders().set(added.key, added.value).set(enabled.key, enabled.value),
      )
      expect(await textFieldOf(pane)).toBeDefined()
      expect(await switchOf(pane, 4)).toBe(await switchOf(pane, 1))

      await pane.press({ key: 'done-4' })
      expect(await textFieldOf(pane)).toBeUndefined()
      expect(await switchOf(pane, 4)).toBe(await switchOf(pane, 1))
    },
  )

  test(
    'the switch of a card draws the phrase typed without an Enter as a row, above an empty field',
    async ($, on) => {
      await startSession($, on, { stored: storedReminders() })
      const pane = await mountRemindersPane($, 'terminal')
      await addCard(pane, UPDATE_SPEC)
      await pane.press({ key: 'switch-4' })

      expect(await removePhraseButtonOf(pane, PHRASE)).toBeDefined()
      const [, phraseField] = await pane.findAll({ type: 'Input' })
      expect(phraseField?.props.value).toBe('')
    },
  )

  test(
    'a new card with a blank text shows a warning on Done and on its switch, and stores nothing',
    async ($, on) => {
      const session = await startSession($, on, { stored: storedReminders() })
      const pane = await mountRemindersPane($, 'terminal')
      await addCard(pane, '   ')
      await pane.press({ key: 'done-4' })

      expect(await warningsOf(pane)).toHaveLength(1)
      await pane.press({ key: 'switch-4' })
      expect(await warningsOf(pane)).toHaveLength(1)
      expect(await switchOf(pane, 4)).toBe(await switchOf(pane, 2))
      expect(reminderRecordsOf(session)).toEqual(storedReminders())

      await typeIntoCard(pane, UPDATE_SPEC, 'change')
      expect(await warningsOf(pane)).toEqual([])
    },
  )

  test('Remove on a new card drops the card and stores nothing', async ($, on) => {
    const session = await startSession($, on, { stored: storedReminders() })
    const pane = await mountRemindersPane($, 'terminal')
    await addCard(pane, UPDATE_SPEC)
    await pane.press({ key: 'remove-4' })

    expect(await textFieldOf(pane)).toBeUndefined()
    expect(await pane.find({ key: 'add-reminder' })).toBeDefined()
    expect(reminderRecordsOf(session)).toEqual(storedReminders())
  })

  test(
    'Edit draws the stored text in the field, and Enter in it stores the new text alone',
    async ($, on) => {
      const session = await startSession($, on, { stored: storedReminders() })
      const pane = await mountRemindersPane($, 'terminal')
      await expect(pane.press({ key: 'edit-2' })).rejects.toThrow(NO_FOCUS_IN_KIT)

      expect((await textFieldOf(pane))?.props.value).toBe(START_BUILD)
      expect(await switchOf(pane, 2)).not.toBe(await switchOf(pane, 1))
      const edited = 'Start a release build whenever the tests pass.'
      await typeIntoCard(pane, edited, 'change')
      await typeIntoCard(pane, edited, 'submit')

      const text = textRecordOf(FIRST_SESSION, 'start-build', edited, NOW)
      expect(reminderRecordsOf(session)).toEqual(storedReminders().set(text.key, text.value))
      expect(await textFieldOf(pane)).toBeUndefined()
      expect(await pane.find({ type: 'Text', text: edited })).toBeDefined()
    },
  )

  // A terminal field still shows what it showed for its key while the value drawn for it is
  // unchanged, and Enter leaves it empty. So a card opened again with the same key showed an
  // empty field.
  test(
    'Edit after a save with Enter draws the text field under a new key, with the stored text',
    async ($, on) => {
      await startSession($, on, { stored: storedReminders() })
      const pane = await mountRemindersPane($, 'terminal')
      await expect(pane.press({ key: 'edit-1' })).rejects.toThrow(NO_FOCUS_IN_KIT)
      const firstOpening = (await textFieldOf(pane))?.key
      await typeIntoCard(pane, MARK_GOAL, 'submit')
      await expect(pane.press({ key: 'edit-1' })).rejects.toThrow(NO_FOCUS_IN_KIT)

      const reopened = await textFieldOf(pane)
      expect(reopened?.key).not.toBe(firstOpening)
      expect(reopened?.props.value).toBe(MARK_GOAL)
    },
  )

  // The engine sends a change of a field and the Enter in it as separate inputs, and the Enter
  // carries the whole text. A save of the text of the last change missed typing that arrived with
  // the Enter.
  test(
    'Enter stores the text the field has at the Enter, without a change of it before',
    async ($, on) => {
      const session = await startSession($, on, { stored: storedReminders() })
      const pane = await mountRemindersPane($, 'terminal')
      await expect(pane.press({ key: 'add-reminder' })).rejects.toThrow(NO_FOCUS_IN_KIT)
      await typePhrase(pane, PHRASE, 'change')
      await typeIntoCard(pane, UPDATE_SPEC, 'submit')

      const id = addedIdOf(session)
      const added = reminderRecordOf(FIRST_SESSION, {
        id,
        number: 4,
        text: UPDATE_SPEC,
        addedAt: NOW,
        cadence: SAYS_TESTS_PASS,
      })
      expect(reminderRecordsOf(session)).toEqual(storedReminders().set(added.key, added.value))
    },
  )

  // The engine opens the list of a focused dropdown whose key changes, so a kind dropdown drawn
  // under a new key after a pick showed its list again.
  test(
    'a kind picked in the dropdown keeps the dropdown under its key, and draws new fields of the ' +
      'kind',
    async ($, on) => {
      await startSession($, on, { stored: storedReminders() })
      const pane = await mountRemindersPane($, 'terminal')
      await expect(pane.press({ key: 'add-reminder' })).rejects.toThrow(NO_FOCUS_IN_KIT)
      const kindDropdown = await kindDropdownOf(pane)
      const [, phrasesField] = await pane.findAll({ type: 'Input' })
      await pane.select({ key: kindDropdown, value: TIME_KIND.id })

      const [dropdown, unitDropdown] = await pane.findAll({ type: 'Select' })
      expect(dropdown?.key).toBe(kindDropdown)
      expect(unitDropdown).toBeDefined()
      expect(await pane.find({ key: phrasesField?.key ?? '' })).toBeUndefined()
    },
  )

  // The engine empties the field an Enter was pressed in once the Enter was handled, so a card that
  // stayed open under the same keys showed the placeholder in place of the text typed.
  test(
    'Enter on a card refused for its cadence draws the text field anew with the text typed',
    async ($, on) => {
      const session = await startSession($, on, { stored: storedReminders() })
      const pane = await mountRemindersPane($, 'terminal')
      await expect(pane.press({ key: 'add-reminder' })).rejects.toThrow(NO_FOCUS_IN_KIT)
      const firstDrawing = (await textFieldOf(pane))?.key
      await typeIntoCard(pane, UPDATE_SPEC, 'submit')

      const redrawn = await textFieldOf(pane)
      expect(redrawn?.key).not.toBe(firstDrawing)
      expect(redrawn?.props.value).toBe(UPDATE_SPEC)
      expect(await warningsOf(pane)).toHaveLength(1)
      expect(reminderRecordsOf(session)).toEqual(storedReminders())
    },
  )

  test(
    'a new card picking "every" stores every 1 hour on Done, with nothing typed into the amount',
    async ($, on) => {
      const session = await startSession($, on, { stored: storedReminders() })
      const pane = await mountRemindersPane($, 'terminal')
      await expect(pane.press({ key: 'add-reminder' })).rejects.toThrow(NO_FOCUS_IN_KIT)
      await typeIntoCard(pane, UPDATE_SPEC, 'change')
      await pane.select({ key: await kindDropdownOf(pane), value: TIME_KIND.id })
      const [, amountField] = await pane.findAll({ type: 'Input' })
      expect(amountField?.props.value).toBe('1')
      await pane.press({ key: 'done-4' })

      const added = reminderRecordOf(FIRST_SESSION, {
        id: addedIdOf(session),
        number: 4,
        text: UPDATE_SPEC,
        addedAt: NOW,
        cadence: { kind: TIME_KIND.id, values: { amount: '1', unit: TimeUnit.Hours } },
      })
      expect(reminderRecordsOf(session)).toEqual(storedReminders().set(added.key, added.value))
      expect(await pane.find({ type: 'Text', text: 'every 1 hour' })).toBeDefined()
    },
  )

  test(
    'a phrase typed without an Enter is dropped when another kind is picked',
    async ($, on) => {
      const session = await startSession($, on, { stored: storedReminders() })
      const pane = await mountRemindersPane($, 'terminal')
      await addCard(pane, UPDATE_SPEC)
      await pane.select({ key: await kindDropdownOf(pane), value: TIME_KIND.id })
      await pane.press({ key: 'done-4' })

      const added = reminderRecordOf(FIRST_SESSION, {
        id: addedIdOf(session),
        number: 4,
        text: UPDATE_SPEC,
        addedAt: NOW,
        cadence: { kind: TIME_KIND.id, values: { amount: '1', unit: TimeUnit.Hours } },
      })
      expect(reminderRecordsOf(session)).toEqual(storedReminders().set(added.key, added.value))
    },
  )

  test(
    'Enter in the phrase field adds the phrase as a row, and its button removes the row',
    async ($, on) => {
      const session = await startSession($, on, { stored: storedReminders() })
      const pane = await mountRemindersPane($, 'terminal')
      await expect(pane.press({ key: 'add-reminder' })).rejects.toThrow(NO_FOCUS_IN_KIT)
      await typeIntoCard(pane, UPDATE_SPEC, 'change')
      await addPhrase(pane, ' finished testing ')
      await addPhrase(pane, PHRASE)

      expect(await pane.find({ type: 'Text', text: 'finished testing' })).toBeDefined()
      expect(await pane.find({ type: 'Text', text: PHRASE })).toBeDefined()
      expect(reminderRecordsOf(session)).toEqual(storedReminders())
      const removeButton = await removePhraseButtonOf(pane, 'finished testing')
      await pane.press({ key: removeButton?.key ?? '' })
      expect(await pane.find({ type: 'Text', text: 'finished testing' })).toBeUndefined()

      await pane.press({ key: 'done-4' })
      const added = reminderRecordOf(FIRST_SESSION, {
        id: addedIdOf(session),
        number: 4,
        text: UPDATE_SPEC,
        addedAt: NOW,
        cadence: SAYS_TESTS_PASS,
      })
      expect(reminderRecordsOf(session)).toEqual(storedReminders().set(added.key, added.value))
      expect(await pane.find({ type: 'Text', text: `when Claude says "${PHRASE}"` })).toBeDefined()
    },
  )

  // The pane keeps its focus as a position among its fields and buttons, and the row of a new
  // phrase is drawn at the position of the phrase field, so the next phrase typed went into the
  // prompt. The kit keeps no focus ring and does not pass a move of the focus to the hooks of a
  // test, so the test reads that the Enter asks for a move, after the field is drawn anew under a
  // new key.
  test(
    'Enter in the phrase field draws an empty phrase field under a new key and moves the focus',
    async ($, on) => {
      await startSession($, on, { stored: storedReminders() })
      const pane = await mountRemindersPane($, 'terminal')
      await expect(pane.press({ key: 'add-reminder' })).rejects.toThrow(NO_FOCUS_IN_KIT)
      const [, typedInto] = await pane.findAll({ type: 'Input' })
      await addPhrase(pane, PHRASE)

      const [, nextPhraseField] = await pane.findAll({ type: 'Input' })
      expect(await removePhraseButtonOf(pane, PHRASE)).toBeDefined()
      expect(nextPhraseField?.props.value).toBe('')
      expect(nextPhraseField?.key).not.toBe(typedInto?.key)
    },
  )

  test(
    'two remove buttons pressed before the pane draws the first removal remove only the first row',
    async ($, on) => {
      await startSession($, on, { stored: storedReminders() })
      const pane = await mountRemindersPane($, 'terminal')
      await expect(pane.press({ key: 'add-reminder' })).rejects.toThrow(NO_FOCUS_IN_KIT)
      for (const phrase of ['finished testing', 'all green', PHRASE, 'build done']) {
        await addPhrase(pane, phrase)
      }
      const first = await removePhraseButtonOf(pane, 'finished testing')
      const third = await removePhraseButtonOf(pane, PHRASE)

      await Promise.all([
        pane.press({ key: first?.key ?? '' }),
        pane.press({ key: third?.key ?? '' }),
      ])
      expect(await removePhraseButtonOf(pane, 'finished testing')).toBeUndefined()
      for (const phrase of ['all green', PHRASE, 'build done']) {
        expect(await removePhraseButtonOf(pane, phrase)).toBeDefined()
      }
    },
  )

  test(
    'Edit on a reminder stored with phrases typed in quotes draws each phrase on a row, and Done ' +
      'stores them as a list',
    async ($, on) => {
      const stored = storedWithPhrasesOfReminder1('"finished testing", "tests pass"')
      const session = await startSession($, on, { stored })
      const pane = await mountRemindersPane($, 'terminal')
      await expect(pane.press({ key: 'edit-1' })).rejects.toThrow(NO_FOCUS_IN_KIT)

      expect(await removePhraseButtonOf(pane, 'finished testing')).toBeDefined()
      expect(await removePhraseButtonOf(pane, PHRASE)).toBeDefined()
      await pane.press({ key: 'done-1' })
      const cadence = { kind: PHRASE_KIND.id, values: { phrases: ['finished testing', PHRASE] } }
      const listed = cadenceRecordOf(FIRST_SESSION, 'mark-goal', cadence, NOW)
      expect(reminderRecordsOf(session)).toEqual(stored.set(listed.key, listed.value))
    },
  )

  test(
    'a reminder stored with phrases that cannot be read shows the problem, and Edit draws no row',
    async ($, on) => {
      const unreadable = '"tests pass", "done'
      await startSession($, on, { stored: storedWithPhrasesOfReminder1(unreadable) })
      const pane = await mountRemindersPane($, 'terminal')

      expect(await warningsOf(pane)).toHaveLength(1)
      await expect(pane.press({ key: 'edit-1' })).rejects.toThrow(NO_FOCUS_IN_KIT)
      expect(await removePhraseButtonOf(pane, unreadable)).toBeUndefined()
      expect(await removePhraseButtonOf(pane, PHRASE)).toBeUndefined()
    },
  )

  test(
    'the text field and the field that adds a phrase are drawn under the edited card, each ' +
      'after its label, and the phrases added stay in the card',
    async ($, on) => {
      await startSession($, on, { stored: storedReminders() })
      const pane = await mountRemindersPane($, 'terminal')
      await expect(pane.press({ key: 'edit-1' })).rejects.toThrow(NO_FOCUS_IN_KIT)
      const { card, holder } = cardKeyedIn(await pane.drawn(), 'reminder-1')

      expect(holder).toMatchObject(layoutOfEditedPhraseCard('reminder-1'))
      expect(shownTextsIn(card)).toContain(describeRemoveItem(PHRASE))
    },
  )

  test(
    'a new card lists no phrase and no label of the phrases in the card, and a phrase added from ' +
      'the field under it is listed in the card without a label',
    async ($, on) => {
      await startSession($, on, { stored: storedReminders() })
      const pane = await mountRemindersPane($, 'terminal')
      await expect(pane.press({ key: 'add-reminder' })).rejects.toThrow(NO_FOCUS_IN_KIT)
      const newCard = async () => cardKeyedIn(await pane.drawn(), 'reminder-4')
      const labelsOfPhrasesIn = (texts: readonly string[]) =>
        texts.filter(text => PHRASE_FIELD_LABELS.includes(text))
      const { card, holder } = await newCard()

      expect(holder).toMatchObject(layoutOfEditedPhraseCard('reminder-4'))
      expect(shownTextsIn(card)).not.toContain(REMOVE_ITEM_MARK)
      expect(labelsOfPhrasesIn(shownTextsIn(card))).toEqual([])
      await addPhrase(pane, PHRASE)

      const added = shownTextsIn((await newCard()).card)
      expect(added).toContain(describeRemoveItem(PHRASE))
      expect(labelsOfPhrasesIn(added)).toEqual([])
    },
  )

  test('Done on an unchanged card stores nothing', async ($, on) => {
    const session = await startSession($, on, { stored: storedReminders() })
    const pane = await mountRemindersPane($, 'terminal')
    await expect(pane.press({ key: 'edit-1' })).rejects.toThrow(NO_FOCUS_IN_KIT)
    await pane.press({ key: 'done-1' })

    expect(reminderRecordsOf(session)).toEqual(storedReminders())
    expect(await textFieldOf(pane)).toBeUndefined()
  })

  test('the switch turns a reminder off, and on again', async ($, on) => {
    const session = await startSession($, on, { stored: storedReminders() })
    const pane = await mountRemindersPane($, 'terminal')
    await pane.press({ key: 'switch-1' })

    const off = enabledRecordOf(FIRST_SESSION, 'mark-goal', false, NOW)
    expect(reminderRecordsOf(session)).toEqual(storedReminders().set(off.key, off.value))
    expect(await switchOf(pane, 1)).toBe(await switchOf(pane, 2))

    await pane.press({ key: 'switch-1' })
    const back = enabledRecordOf(FIRST_SESSION, 'mark-goal', true, NOW)
    expect(reminderRecordsOf(session)).toEqual(storedReminders().set(back.key, back.value))
    expect(await switchOf(pane, 1)).not.toBe(await switchOf(pane, 2))
  })

  test('a press of the switch lists the keys of the store once', async ($, on) => {
    let listings = 0
    on('store.keys', EVERY_EVENT, ($, e, next) => {
      listings += 1

      return next(e)
    })
    await startSession($, on, { stored: storedReminders() })
    const pane = await mountRemindersPane($, 'terminal')
    listings = 0
    await pane.press({ key: 'switch-1' })

    expect(listings).toBe(1)
  })

  test(
    'while a save runs, the card shows that it saves, and a press that could save is ignored',
    async ($, on) => {
      let writes = 0
      let reportWrite = () => {}
      const isWriting = new Promise<void>(resolve => {
        reportWrite = resolve
      })
      let endWrite = () => {}
      const isWritten = new Promise<void>(resolve => {
        endWrite = resolve
      })
      on('store.set', EVERY_EVENT, async ($, e, next) => {
        if (e.key.startsWith(remindersPrefixOf(FIRST_SESSION))) {
          writes += 1
          reportWrite()
          await isWritten
        }

        return next(e)
      })
      await startSession($, on, { stored: storedReminders() })
      const pane = await mountRemindersPane($, 'terminal')
      const before = await textsOf(pane)
      const switched = pane.press({ key: 'switch-1' })
      await isWriting

      const shownWhileSaving = (await textsOf(pane)).filter(text => !before.includes(text))
      await pane.press({ key: 'switch-1' })
      endWrite()
      await switched
      expect(shownWhileSaving).toHaveLength(1)
      expect(await textsOf(pane)).not.toContain(shownWhileSaving[0])
      expect(writes).toBe(1)
    },
  )

  test(
    'Remove asks first, Keep keeps the reminder, and Yes, remove removes it for good',
    async ($, on) => {
      const session = await startSession($, on, { stored: storedReminders() })
      const pane = await mountRemindersPane($, 'terminal')
      await pane.press({ key: 'remove-2' })

      expect(await pane.find({ key: 'confirm-remove-2' })).toBeDefined()
      expect(await pane.find({ key: 'switch-2' })).toBeUndefined()
      await pane.press({ key: 'keep-2' })
      expect(await pane.find({ key: 'confirm-remove-2' })).toBeUndefined()
      expect(await pane.find({ key: 'switch-2' })).toBeDefined()
      expect(reminderRecordsOf(session)).toEqual(storedReminders())

      await pane.press({ key: 'remove-2' })
      await pane.press({ key: 'confirm-remove-2' })
      const removal = removalRecordOf(FIRST_SESSION, 'start-build', NOW)
      expect(reminderRecordsOf(session)).toEqual(
        storedReminders().set(removal.key, removal.value),
      )
      expect(await pane.find({ type: 'Text', text: START_BUILD })).toBeUndefined()
      await expect(pane.press({ key: 'add-reminder' })).rejects.toThrow(NO_FOCUS_IN_KIT)
      expect(await switchOf(pane, 4)).not.toBe(await switchOf(pane, 1))
    },
  )

  test(
    'a failed save shows a toast, and Done again saves the text typed before',
    async ($, on) => {
      const session = await startSession($, on, { stored: storedReminders() })
      const pane = await mountRemindersPane($, 'terminal')
      await addCard(pane, UPDATE_SPEC)
      session.refusedWrites.push(FULL_STORE)
      await pane.press({ key: 'done-4' })

      expect(session.toasts).toHaveLength(1)
      expect(session.toasts[0]).toContain(FULL_STORE)
      expect(await textFieldOf(pane)).toBeDefined()
      expect(reminderRecordsOf(session)).toEqual(storedReminders())

      await pane.press({ key: 'done-4' })
      const id = addedIdOf(session)
      const added = reminderRecordOf(FIRST_SESSION, {
        id,
        number: 4,
        text: UPDATE_SPEC,
        addedAt: NOW,
        cadence: SAYS_TESTS_PASS,
      })
      expect(reminderRecordsOf(session)).toEqual(storedReminders().set(added.key, added.value))
    },
  )

  test(
    'a record the plugin cannot read is named in the pane, and the other reminders stay',
    async ($, on) => {
      const unreadable = `${remindersPrefixOf(FIRST_SESSION)}mark-goal:text`
      const stored = storedReminders().set(unreadable, { version: 2, text: 'from a newer plugin' })
      await startSession($, on, { stored })
      const pane = await mountRemindersPane($, 'terminal')

      expect(await pane.find({ type: 'Text', text: new RegExp(unreadable) })).toBeDefined()
      expect(await pane.find({ type: 'Text', text: MARK_GOAL })).toBeDefined()
      expect(await pane.find({ type: 'Text', text: START_BUILD })).toBeDefined()
    },
  )

  test(
    'a reminder keeps its number when the record of an earlier reminder cannot be read',
    async ($, on) => {
      const first = `${remindersPrefixOf(FIRST_SESSION)}mark-goal`
      await startSession($, on, { stored: storedReminders().set(first, { version: 2 }) })
      const pane = await mountRemindersPane($, 'terminal')

      expect(await pane.find({ key: 'edit-1' })).toBeUndefined()
      expect(await pane.find({ key: 'edit-2' })).toBeDefined()
    },
  )

  test(
    'the phone draws each reminder with its switch and Remove, no field, and a line the ' +
      'terminal does not draw',
    async ($, on) => {
      const session = await startSession($, on, { stored: storedReminders() })
      const inTerminal = await textsOf(await mountRemindersPane($, 'terminal'))
      const pane = await mountRemindersPane($, 'mobile')

      expect(await pane.find({ type: 'Text', text: MARK_GOAL })).toBeDefined()
      expect(await switchOf(pane, 1)).not.toBe(await switchOf(pane, 2))
      expect(await pane.find({ key: 'remove-1' })).toBeDefined()
      expect(await pane.find({ key: 'edit-1' })).toBeUndefined()
      expect(await pane.find({ key: 'add-reminder' })).toBeUndefined()
      expect((await textsOf(pane)).filter(text => !inTerminal.includes(text))).toHaveLength(1)

      await pane.press({ key: 'switch-1' })
      const off = enabledRecordOf(FIRST_SESSION, 'mark-goal', false, NOW)
      expect(reminderRecordsOf(session)).toEqual(storedReminders().set(off.key, off.value))
    },
  )
})
