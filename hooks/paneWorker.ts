import type {
  Caught,
  ClientProps,
  ElementConstructor,
  EngineInterface,
  Frozen,
  RenderElement,
  RenderSurface,
  ResolveInput,
  UiMessageArgument,
  UiMessageResult,
} from 'claude-code'

import { showFailure } from './failureToast'
import { describeHookFailure } from './hookFailure'
import type { HookSubject } from './hookFailure'
import {
  drawFieldsUnder,
  moduleFieldsAt,
  readFocusAsk,
  readPostedFields,
  withPostedFields,
  withSubmit,
} from './paneFieldArea'
import type { FieldsAt, ModuleFields } from './paneFieldArea'
import type { TypedTexts } from './paneFields'
import { settledState, stateOfSession, stepOfSave, steppedState } from './paneModule'
import type {
  PaneAnswer,
  PaneMachine,
  PanePost,
  PanePress,
  PaneProps,
  PaneSave,
  PaneState,
  PaneSurface,
  TypedSave,
} from './paneModule'
import { paneElementsOf } from './paneElements'
import type { PaneElements } from './paneElements'
import { describeFocusNotMoved, describeModuleFault, describeUnreadablePost } from './paneTexts'
import { isRecord, readStrings } from './pluginStore'
import { drawsClient, drawsFields } from './surfaces'
import { UnreadablePost } from './unreadablePost'

// The side of a pane in the hooks module. It runs the saves posted by the surface module of the
// pane, and records the result of each by its action id before it answers, so every drawing of the
// pane sends the results to the module. It draws the text fields posted by the module under it,
// records the text typed into them, and records the field events for the module. A surface that
// draws no surface module, such as the mobile app, and a surface where the module failed get the
// pane drawn by the hooks module, with the state of the presses in the state of the plugin. Their
// presses wait for the worker, as every press drawn by the hooks module does.

/**
 * A save of a pane run by the hooks module: the id given to it by the pane, the surface it was made
 * on, the id of the hook run that runs it, and its result, null while it runs. Once the pane leaves
 * a save with a result out of its queue, the pane has ended the save.
 */
export type RecordedSave<Result> = {
  actionId: string
  surface: RenderSurface
  runId: string
  result: Result | null
  isEndedByPane: boolean
}

/** What the hooks module stores of a pane, which its drawing reads. */
export type PaneRecord<Local, Action, Result> = {
  /**
   * The state of the presses where the hooks module draws the pane; null before the first press
   * after the pane opened. The texts typed into its fields are in TypedInWorker.
   */
  inWorker: PaneState<Local, Action> | null
  /** The saves run since the pane opened, and the saves run before whose pane did not end them. */
  saves: readonly RecordedSave<Result>[]
  /** The surfaces whose surface module failed since the pane opened. */
  faulted: readonly RenderSurface[]
  /** The text fields drawn under the surface module since the pane opened, where it posted them. */
  moduleFields: readonly ModuleFields[]
}

/**
 * The tag the stored pane records are kept under. A change of PaneRecord changes the tag, so a
 * record written by another version of the plugin reads as absent.
 */
export const PANE_RECORD_SHAPE = 'saves-and-numbered-field-events'

export const NEW_PANE_RECORD: PaneRecord<never, never, never> = {
  inWorker: null,
  saves: [],
  faulted: [],
  moduleFields: [],
}

/**
 * The texts typed into the text fields of a pane drawn by the hooks module, under its surface
 * module or in its drawing by the hooks module, in the session `sessionId`. The drawing does not
 * read them, so a typed character does not draw the pane again.
 */
export type TypedInWorker = { sessionId: string; texts: TypedTexts }

/** The texts typed into a pane: as read, and how a change is written. */
type StoredTyped = {
  read: () => Promise<TypedInWorker | null>
  update: (
    change: (typed: TypedInWorker | null) => TypedInWorker | null,
  ) => Promise<TypedInWorker | null>
}

/**
 * The record of a pane in the state of the plugin: as read, and how a change is written, with the
 * texts typed into it, for a pane that draws text fields.
 */
export type StoredPane<Local, Action, Result> = {
  read: () => Promise<PaneRecord<Local, Action, Result>>
  update: (
    change: (record: PaneRecord<Local, Action, Result>) => PaneRecord<Local, Action, Result>,
  ) => Promise<PaneRecord<Local, Action, Result>>
  typed?: StoredTyped
}

/**
 * A pane as the hooks module draws and saves it, for the engine of one hook: its title, its
 * drawing, how its view is read, how a posted action is read and saved, the result of a save whose
 * hook failed, the subject of the texts about that failure, and its record.
 */
export type PaneSite<View, Local, Action, Result> = {
  title: string
  machine: PaneMachine<View, Local, Action, Result>
  readView: () => Promise<View>
  readAction: (action: unknown) => Action | UnreadablePost
  save: (action: Action) => Promise<Result>
  failed: Result
  subject: HookSubject
  stored: StoredPane<Local, Action, Result>
}

/** How the hooks module draws the surface module of a pane, with its props. */
export type ClientOfPane<View, Result> = (
  Client: ElementConstructor<ClientProps>,
  props: PaneProps<View, Result>,
) => RenderElement

/**
 * Draws the pane of `site` on the surface of `e`: in its surface module, drawn by `drawClient`,
 * with the text fields posted by the module under it, where the surface draws one and the module
 * did not fail there since the pane opened, and by the hooks module elsewhere.
 */
export async function drawPane<View, Local, Action, Result>(
  $: EngineInterface,
  e: ResolveInput<'Pane'>,
  site: PaneSite<View, Local, Action, Result>,
  drawClient: ClientOfPane<View, Result>,
): Promise<RenderElement> {
  const record = await site.stored.read()
  const props = await panePropsOf($, site, record, e.surface)
  const type = (field: string, text: string) =>
    typeIntoField(site.stored, { sessionId: props.sessionId, field, text })
  if (drawsClient(e) && !record.faulted.includes(e.surface)) {
    const elements = $.ui.resolve(e)
    const at = { surface: e.surface, sessionId: props.sessionId }
    const fields = moduleFieldsAt(record.moduleFields, at)?.posted ?? []

    return drawFieldsUnder(elements, drawClient(elements.Client, props), fields, {
      type,
      submit: (field, text) => recordSubmit(site.stored, at, { field, text }),
    })
  }

  const elements = $.ui.resolve(e)
  // The surface empties a field after Enter, so Enter records the text typed into it as empty.
  const TextInput: PaneElements['TextInput'] = ({ onSubmit, ...input }) =>
    elements.Input({
      ...input,
      onInput: text => type(input.key, text),
      onSubmit: async text => {
        await type(input.key, '')
        await onSubmit(text)
      },
    })

  return drawPaneInWorker(
    site,
    props,
    { elements: { ...paneElementsOf(elements), TextInput }, drawsFields: drawsFields(e) },
    { record, surface: e.surface },
  )
}

/** The texts of `typed` typed in the session `sessionId`, none for another session. */
function typedTextsIn(typed: TypedInWorker | null | undefined, sessionId: string): TypedTexts {
  return typed?.sessionId === sessionId ? typed.texts : {}
}

/** Records `text` as typed into the text field `field` of the pane of `stored`. */
async function typeIntoField<Local, Action, Result>(
  stored: StoredPane<Local, Action, Result>,
  { sessionId, field, text }: { sessionId: string; field: string; text: string },
): Promise<void> {
  await stored.typed?.update(typed => ({
    sessionId,
    texts: { ...typedTextsIn(typed, sessionId), [field]: text },
  }))
}

/**
 * Records Enter in the text field `field` drawn at `at` under the surface module of the pane of
 * `stored`, with its whole text `text` and the texts typed into the other fields, for the module.
 * The surface empties a field after Enter, so the text typed into it is recorded as empty.
 */
async function recordSubmit<Local, Action, Result>(
  stored: StoredPane<Local, Action, Result>,
  at: FieldsAt,
  { field, text }: { field: string; text: string },
): Promise<void> {
  const typed = { ...typedTextsIn(await stored.typed?.read(), at.sessionId), [field]: text }
  await typeIntoField(stored, { sessionId: at.sessionId, field, text: '' })
  await stored.update(record => ({
    ...record,
    moduleFields: withSubmit(record.moduleFields, at, { field, text, typed }),
  }))
}

/**
 * Records the text fields posted by the surface module of the pane of `site` and the texts typed
 * by the time of the presses waiting in it, gives the keyboard to the field it asks for, runs its
 * saves, and returns its props. A post made in another session than the one that runs is not
 * recorded or run: its saves name goals and reminders of that session, and the pane drawn in this
 * session starts over without them.
 */
export async function answerPanePost<View, Local, Action, Result>(
  $: EngineInterface,
  e: Frozen<UiMessageArgument>,
  site: PaneSite<View, Local, Action, Result>,
): Promise<UiMessageResult> {
  const post = readPanePost(e.data, site.readAction)
  if (post instanceof UnreadablePost) {
    throw new Error(describeUnreadablePost(site.title, post.problem))
  }
  if (post.sessionId === (await $.session.id())) {
    const at = { surface: e.surface, sessionId: post.sessionId }
    const [shown, typed] = await Promise.all([site.stored.read(), site.stored.typed?.read()])
    await site.stored.update(record => ({
      ...withSavesEnded(record, e.surface, post.saves),
      moduleFields: withPostedFields(
        record.moduleFields,
        at,
        post,
        typedTextsIn(typed, post.sessionId),
      ),
    }))
    const { focus } = post
    if (focus !== null && focus.askId !== moduleFieldsAt(shown.moduleFields, at)?.focused) {
      await focusField($, { title: site.title, requestId: e.requestId, field: focus.field })
    }
    await runSaves(site, e.surface, post.saves)
  }

  return { props: await panePropsOf($, site, await site.stored.read(), e.surface) }
}

/**
 * Shows the failure of the hook that ran the saves posted by the pane of `site`, records each of
 * them that still runs as failed, and returns the props of the pane. The pane draws a failed save
 * as before it, and posts the saves left.
 */
export async function answerFailedPanePost<View, Local, Action, Result>(
  $: EngineInterface,
  e: Frozen<UiMessageArgument>,
  next: Caught,
  site: PaneSite<View, Local, Action, Result>,
): Promise<UiMessageResult> {
  showFailure($, describeHookFailure(site.subject, next.error))
  const post = readPanePost(e.data, site.readAction)
  if (post instanceof UnreadablePost) {
    return {}
  }
  const posted = new Set(post.saves.map(({ actionId }) => actionId))
  const record = await site.stored.update(stored => ({
    ...stored,
    saves: stored.saves.map(save =>
      posted.has(save.actionId) && save.result === null ? { ...save, result: site.failed } : save,
    ),
  }))

  return { props: await panePropsOf($, site, record, e.surface) }
}

/**
 * Gives the keyboard to the text field `field` of the pane `title`, drawn as `requestId`, and
 * writes why to the debug log where it did not move. A press on a Button of a surface module
 * leaves the keyboard where it was, so a pane without it asks for it as it does when it opens.
 * The surface refuses that while the prompt has text or a dialog has the keyboard.
 */
async function focusField(
  $: EngineInterface,
  { title, requestId, field }: { title: string; requestId: string; field: string },
): Promise<void> {
  if (!(await $.ui.panes()).some(({ id, isFocused }) => id === requestId && isFocused)) {
    const opened = await $.ui.open({ id: requestId, title, focus: true })
    if (!opened.isPlaced) {
      $.ui.log(describeFocusNotMoved(title, opened.reason), { to: 'debug' })

      return
    }
  }
  const focused = await $.ui.focus({ requestId, key: field })
  if (focused.deny !== undefined) {
    $.ui.log(describeFocusNotMoved(title, focused.deny), { to: 'debug' })
  }
}

/**
 * Records that the surface module of the pane of `site` failed on `surface` for `reason`, and draws
 * the pane again, by the hooks module there until the pane is opened again.
 */
export async function recordModuleFault<View, Local, Action, Result>(
  $: EngineInterface,
  site: PaneSite<View, Local, Action, Result>,
  { surface, reason }: { surface: RenderSurface; reason: string },
): Promise<void> {
  $.ui.log(describeModuleFault(site.title, surface, reason), { to: 'debug' })
  await site.stored.update(record =>
    record.faulted.includes(surface)
      ? record
      : { ...record, faulted: [...record.faulted, surface] },
  )
  $.ui.invalidate('ui.render')
}

/**
 * Stores the pane of `stored` as it opens under the id `paneId`: without a pressed row or card,
 * texts typed, failed modules and text fields of a module, with the saves not ended by the pane and
 * still awaited by a pane open since. The record of a pane open already is left as it is, since
 * opening it again only retitles it, and its surface modules still draw from the state they have.
 */
export async function storeOpenedPane<Local, Action, Result>(
  $: EngineInterface,
  { paneId, stored }: { paneId: string; stored: StoredPane<Local, Action, Result> },
): Promise<void> {
  if ((await $.ui.panes()).some(({ id }) => id === paneId)) {
    return
  }
  await stored.update(record => ({
    inWorker: null,
    saves: record.saves.filter(save => !save.isEndedByPane),
    faulted: [],
    moduleFields: [],
  }))
  await stored.typed?.update(() => null)
}

async function panePropsOf<View, Local, Action, Result>(
  $: EngineInterface,
  site: PaneSite<View, Local, Action, Result>,
  record: PaneRecord<Local, Action, Result>,
  surface: RenderSurface,
): Promise<PaneProps<View, Result>> {
  const [sessionId, view] = await Promise.all([$.session.id(), site.readView()])
  const fieldEvents = moduleFieldsAt(record.moduleFields, { surface, sessionId })?.events ?? []

  return { sessionId, view, answers: answersOf(record, surface), fieldEvents }
}

/** The results of the saves made on `surface` that the pane did not end yet. */
function answersOf<Local, Action, Result>(
  record: PaneRecord<Local, Action, Result>,
  surface: RenderSurface,
): PaneAnswer<Result>[] {
  return record.saves.flatMap(save =>
    save.surface === surface && save.result !== null && !save.isEndedByPane
      ? [{ actionId: save.actionId, result: save.result }]
      : [],
  )
}

/** `record` with each save made on `surface` that has a result and is not in `waiting` ended. */
function withSavesEnded<Local, Action, Result>(
  record: PaneRecord<Local, Action, Result>,
  surface: RenderSurface,
  waiting: readonly PaneSave<Action>[],
): PaneRecord<Local, Action, Result> {
  const waitingIds = new Set(waiting.map(({ actionId }) => actionId))

  return {
    ...record,
    saves: record.saves.map(save =>
      save.surface === surface && save.result !== null && !waitingIds.has(save.actionId)
        ? { ...save, isEndedByPane: true }
        : save,
    ),
  }
}

/** Whether a hook run may run a save, by its record. */
enum SaveClaim {
  /** The save was not run, and the hook run now runs it. */
  Claimed = 'claimed',
  /** Another hook run runs the save. */
  Running = 'running',
  Answered = 'answered',
}

/**
 * Runs each save of `saves` that has not run, in order, and records its result, also the failed
 * result of a save that throws. Stops at a save that another hook run runs: the pane posts the
 * saves after it again once its result arrived. Returns whether it ran a save.
 */
async function runSaves<View, Local, Action, Result>(
  site: PaneSite<View, Local, Action, Result>,
  surface: RenderSurface,
  saves: readonly PaneSave<Action>[],
): Promise<boolean> {
  const runId = crypto.randomUUID()
  let hasRun = false
  for (const { actionId, action } of saves) {
    switch (await claimSave(site.stored, { actionId, surface, runId })) {
      case SaveClaim.Running:
        return hasRun
      case SaveClaim.Answered:
        continue
      case SaveClaim.Claimed:
        break
    }
    hasRun = true
    let result = site.failed
    try {
      result = await site.save(action)
    } finally {
      await site.stored.update(record => withResult(record, actionId, result))
    }
  }

  return hasRun
}

/** Records the save `actionId` as run by `runId`, unless it has a record, and tells the claim. */
async function claimSave<Local, Action, Result>(
  stored: StoredPane<Local, Action, Result>,
  { actionId, surface, runId }: { actionId: string; surface: RenderSurface; runId: string },
): Promise<SaveClaim> {
  const record = await stored.update(current =>
    current.saves.some(save => save.actionId === actionId)
      ? current
      : {
          ...current,
          saves: [
            ...current.saves,
            { actionId, surface, runId, result: null, isEndedByPane: false },
          ],
        },
  )
  const claimed = record.saves.find(save => save.actionId === actionId)
  if (claimed === undefined || claimed.result !== null) {
    return SaveClaim.Answered
  }

  return claimed.runId === runId ? SaveClaim.Claimed : SaveClaim.Running
}

/**
 * `record` with `result` as the result of the save `actionId`, while it runs. A save recorded as
 * failed by the failure of its hook keeps that result.
 */
function withResult<Local, Action, Result>(
  record: PaneRecord<Local, Action, Result>,
  actionId: string,
  result: Result,
): PaneRecord<Local, Action, Result> {
  return {
    ...record,
    saves: record.saves.map(save =>
      save.actionId === actionId && save.result === null ? { ...save, result } : save,
    ),
  }
}

/**
 * The post in `data`, posted by a pane module, with each action read by `readAction`, its text
 * fields and what it sends about them.
 */
function readPanePost<Action>(
  data: unknown,
  readAction: (action: unknown) => Action | UnreadablePost,
): PanePost<Action> | UnreadablePost {
  if (!isRecord(data) || typeof data.sessionId !== 'string') {
    return new UnreadablePost('the post has no session id')
  }
  const posted: unknown = data.saves
  if (!Array.isArray(posted)) {
    return new UnreadablePost('the post has no list of saves')
  }
  const saves: PaneSave<Action>[] = []
  for (const save of posted.values()) {
    if (!isRecord(save) || typeof save.actionId !== 'string') {
      return new UnreadablePost('a save of the post has no action id')
    }
    const action = readAction(save.action)
    if (action instanceof UnreadablePost) {
      return action
    }
    saves.push({ actionId: save.actionId, action })
  }
  const fields = readPostedFields(data.fields)
  if (fields instanceof UnreadablePost) {
    return fields
  }
  const waitingPresses = readStrings(data.waitingPresses)
  if (waitingPresses === undefined) {
    return new UnreadablePost('the post does not contain a list of the presses waiting in it')
  }
  const { appliedFieldEvent } = data
  if (appliedFieldEvent !== null && typeof appliedFieldEvent !== 'number') {
    return new UnreadablePost(
      'the post does not contain the number of the last field event applied',
    )
  }
  const focus = readFocusAsk(data.focus)
  if (focus instanceof UnreadablePost) {
    return focus
  }

  return { sessionId: data.sessionId, saves, fields, waitingPresses, appliedFieldEvent, focus }
}

/** Where the hooks module draws a pane: the record of the pane, and the surface drawn on. */
type DrawnInWorker<Local, Action, Result> = {
  record: PaneRecord<Local, Action, Result>
  surface: RenderSurface
}

/**
 * Draws the pane of `site` from the hooks module, with the state of its presses in its record, and
 * runs the saves queued by each press.
 */
function drawPaneInWorker<View, Local, Action, Result>(
  site: PaneSite<View, Local, Action, Result>,
  props: PaneProps<View, Result>,
  surface: PaneSurface,
  { record, surface: drawnOn }: DrawnInWorker<Local, Action, Result>,
): RenderElement {
  const settledOf = (current: PaneRecord<Local, Action, Result>) =>
    settledState(
      site.machine.settle,
      stateOfSession(site.machine.initial, current.inWorker, props.sessionId),
      answersOf(current, drawnOn),
    )
  const state = settledOf(record)
  const act = async (press: PanePress<Local, Action>) => {
    const actionId = crypto.randomUUID()
    await site.stored.update(current => {
      const settled = settledOf(current)

      return { ...current, inWorker: steppedState(settled, press(settled.local), actionId) }
    })
    await runQueueInWorker(site, drawnOn, settledOf)
  }
  const saveTyped = async (save: TypedSave<Local, Action>) => {
    const typed = typedTextsIn(await site.stored.typed?.read(), props.sessionId)
    await act(local => stepOfSave(save(local, typed)))
  }
  const saves = state.queue.map(({ action }) => action)

  return site.machine.draw(props.view, { local: state.local, saves, act, saveTyped }, surface)
}

/**
 * Ends each save of the queue of the pane drawn by the hooks module on `surface` that has a result,
 * as `settledOf` does, and runs the saves left, until the queue is empty or another press runs its
 * first save.
 */
async function runQueueInWorker<View, Local, Action, Result>(
  site: PaneSite<View, Local, Action, Result>,
  surface: RenderSurface,
  settledOf: (record: PaneRecord<Local, Action, Result>) => PaneState<Local, Action>,
): Promise<void> {
  const record = await site.stored.update(current => {
    const settled = settledOf(current)

    return { ...withSavesEnded(current, surface, settled.queue), inWorker: settled }
  })
  const queue = record.inWorker?.queue ?? []
  if (queue.length > 0 && (await runSaves(site, surface, queue))) {
    await runQueueInWorker(site, surface, settledOf)
  }
}
