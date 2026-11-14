import type { ClientModule, JsonValue, RenderElement } from 'claude-code'

import { drawnControlsOf } from './clientControls'
import { NEW_KEYBOARD, keyboardAfterDrawing, sendKeyToFocusedControl } from './paneKeyboard'
import type { KeyboardStore, PaneKeyboard } from './paneKeyboard'
import type { PaneElements } from './paneElements'
import { FieldEventKind, drawCollectingFields, eventsAfter } from './paneFields'
import type { DrawnField, FieldEvent, PaneField, TypedTexts } from './paneFields'

// A pane drawn by a surface module reacts to every press on the drawing thread, while the worker
// of the hooks module may be busy with the hooks run for every agent in the session. The module
// stores what a press changes in its own state, and puts each save on a queue, in order. Every
// post contains every save of the queue not answered yet, so a post replaced by a later one in the
// same frame loses no save. The hooks module runs each save once, in order, and records its
// result. Every drawing of the pane contains the recent results, which end the saves they answer.
// The text fields of the pane are drawn by the hooks module, which records the text typed into
// them (paneFields.tsx). A press that saves the typed texts waits in the module until the hooks
// module sends the texts recorded by the time of the press.

/** A save made by a pane, under an id new to the save, which its result repeats. */
export type PaneSave<Action> = { actionId: string; action: Action }

/**
 * The text field `field` to be given the keyboard by the hooks module, as asked by a pane module
 * under an id new to the ask.
 */
export type FocusAsk = { askId: string; field: string }

/**
 * What a pane module posts: the session in which its saves were made, every save of its queue not
 * answered yet, in order, the text fields drawn by it, in order, the ids of its presses waiting
 * for the typed texts, the number of the last field event applied by it, null before the first,
 * and the text field to be given the keyboard, null where it draws none with autoFocus.
 */
export type PanePost<Action> = {
  sessionId: string
  saves: readonly PaneSave<Action>[]
  fields: readonly PaneField[]
  waitingPresses: readonly string[]
  appliedFieldEvent: number | null
  focus: FocusAsk | null
}

/** The result of the save made under `actionId`. */
export type PaneAnswer<Result> = { actionId: string; result: Result }

/**
 * What the hooks module sends to a pane: the session that runs, what to draw, the results of the
 * recent saves of the pane, and the field events not yet applied by it, in order.
 */
export type PaneProps<View, Result> = {
  sessionId: string
  view: View
  answers: readonly PaneAnswer<Result>[]
  fieldEvents: readonly FieldEvent[]
}

/**
 * The state of a pane in the session `sessionId`: the state of its presses, and its saves not
 * answered yet, in order.
 */
export type PaneState<Local, Action> = {
  sessionId: string
  local: Local
  queue: readonly PaneSave<Action>[]
}

/**
 * What a press does: the next state of the presses, the save it puts on the queue, if any, and
 * whether it opens a text field, which then gets the keyboard.
 */
export type PaneStep<Local, Action> = { local?: Local; save?: Action; opensField?: true }

/** A press: the step it computes from the state of the presses as it is. */
export type PanePress<Local, Action> = (local: Local) => PaneStep<Local, Action>

/**
 * A press that saves typed texts: the save it makes of the state of the presses and the texts
 * typed into the fields, if any.
 */
export type TypedSave<Local, Action> = (local: Local, typed: TypedTexts) => Action | undefined

/** What the drawing of a pane reads and acts on. */
export type PaneControls<Local, Action> = {
  local: Local
  /** The saves not answered yet, in order: the first runs, and the others wait for it. */
  saves: readonly Action[]
  /** Applies the step that `press` computes from the state of the pane as it is at the press. */
  act: (press: PanePress<Local, Action>) => Promise<void> | void
  /**
   * Queues the save that `save` makes of the state of the pane at the press and the texts typed
   * into its fields by then.
   */
  saveTyped: (save: TypedSave<Local, Action>) => Promise<void> | void
}

/** The elements a pane draws with, and whether the surface draws its input fields. */
export type PaneSurface = { elements: PaneElements; drawsFields: boolean }

/** The state of the presses of a pane once `action` was answered with `result`. */
export type PaneSettle<Local, Action, Result> = (
  local: Local,
  action: Action,
  result: Result,
) => Local

/** A pane: the state of its presses at the start, what a result does to it, and its drawing. */
export type PaneMachine<View, Local, Action, Result> = {
  initial: Local
  settle: PaneSettle<Local, Action, Result>
  draw: (view: View, pane: PaneControls<Local, Action>, surface: PaneSurface) => RenderElement
}

/**
 * `state` in the session `sessionId`. A pane drawn in another session starts over from `initial`,
 * since the presses and saves there are for goals and reminders of that session.
 */
export function stateOfSession<Local, Action>(
  initial: Local,
  state: PaneState<Local, Action> | null | undefined,
  sessionId: string,
): PaneState<Local, Action> {
  return state?.sessionId === sessionId ? state : { sessionId, local: initial, queue: [] }
}

/** `state` after `step`, with the save it puts on the queue under `actionId`, if any. */
export function steppedState<Local, Action>(
  state: PaneState<Local, Action>,
  step: PaneStep<Local, Action>,
  actionId: string,
): PaneState<Local, Action> {
  return {
    ...state,
    local: 'local' in step ? step.local : state.local,
    queue:
      step.save === undefined ? state.queue : [...state.queue, { actionId, action: step.save }],
  }
}

/** The step that puts `save` on the queue, if there is one. */
export function stepOfSave<Local, Action>(save: Action | undefined): PaneStep<Local, Action> {
  return save === undefined ? {} : { save }
}

/** `save` with `text` as the text typed into the field keyed `field`, for Enter in that field. */
export function savedOnEnter<Local, Action>(
  save: TypedSave<Local, Action>,
  field: string,
  text: string,
): TypedSave<Local, Action> {
  return (local, typed) => save(local, { ...typed, [field]: text })
}

/** `state` with every save of its queue that `answers` has a result for ended by `settle`. */
export function settledState<Local, Action, Result>(
  settle: PaneSettle<Local, Action, Result>,
  state: PaneState<Local, Action>,
  answers: readonly PaneAnswer<Result>[],
): PaneState<Local, Action> {
  let { local } = state
  const queue: PaneSave<Action>[] = []
  for (const save of state.queue) {
    const answer = answers.find(each => each.actionId === save.actionId)
    if (answer === undefined) {
      queue.push(save)
    } else {
      local = settle(local, save.action, answer.result)
    }
  }

  return queue.length === state.queue.length ? state : { ...state, local, queue }
}

/**
 * A press of a pane module that saves typed texts, waiting for the hooks module to send them: its
 * id, the state of the presses at the press, and its save.
 */
type WaitingPress<Local, Action> = {
  pressId: string
  local: Local
  save: TypedSave<Local, Action>
}

/**
 * The state of a pane in its surface module: the state of its presses, its keyboard, its presses
 * waiting for the typed texts, in order, the number of the last field event applied by it, null
 * before the first, the id of its last ask for the keyboard, and its last post, null before the
 * first.
 */
export type ModuleState<Local, Action> = {
  pane: PaneState<Local, Action>
  keyboard: PaneKeyboard
  waiting: readonly WaitingPress<Local, Action>[]
  appliedFieldEvent: number | null
  focusAsk: string
  posted: PanePost<Action> | null
}

/**
 * `state` in the session `sessionId`. A module that starts, or draws the pane of another session,
 * starts over from `initial` and asks for the keyboard for its first text field with autoFocus.
 */
function moduleStateOfSession<Local, Action>(
  initial: Local,
  state: ModuleState<Local, Action> | undefined,
  sessionId: string,
): ModuleState<Local, Action> {
  return state?.pane.sessionId === sessionId
    ? state
    : {
        pane: stateOfSession(initial, null, sessionId),
        keyboard: state?.keyboard ?? NEW_KEYBOARD,
        waiting: [],
        appliedFieldEvent: null,
        focusAsk: crypto.randomUUID(),
        posted: null,
      }
}

/**
 * The saves of `state` as its drawing shows them: its queue, and then the save of each waiting
 * press made of the texts drawn into the fields, until the typed texts arrive.
 */
function shownSavesOf<Local, Action>(state: ModuleState<Local, Action>): readonly Action[] {
  return [
    ...state.pane.queue.map(({ action }) => action),
    ...state.waiting.flatMap(({ local, save }) => {
      const shown = save(local, {})

      return shown === undefined ? [] : [shown]
    }),
  ]
}

/** What the module of a pane posts from `state` and the text fields `fields` of its drawing. */
function postOf<Local, Action>(
  state: ModuleState<Local, Action>,
  fields: readonly DrawnField[],
): PanePost<Action> {
  const focused = fields.find(({ shown }) => shown.autoFocus === true)

  return {
    sessionId: state.pane.sessionId,
    saves: state.pane.queue,
    fields: fields.map(({ shown }) => shown),
    waitingPresses: state.waiting.map(({ pressId }) => pressId),
    appliedFieldEvent: state.appliedFieldEvent,
    focus: focused === undefined ? null : { askId: state.focusAsk, field: focused.shown.key },
  }
}

/** Whether `post` is `posted`. Both are plain data, so their JSON texts show them whole. */
function isPosted<Action>(post: PanePost<Action>, posted: PanePost<Action> | null): boolean {
  return JSON.stringify(post) === JSON.stringify(posted)
}

/**
 * The surface module that draws `machine`, with the state of the presses and of the keyboard
 * stored on the drawing thread. It applies the field events of its props before its drawing, each
 * in a drawing of its own, so an event runs on what the events before it changed. A save made by
 * an event gets the id of the event, so an event run again after the module started over is saved
 * once. The module posts once a drawing changed what it posts. A result that ends a save posts the
 * saves left, since the hooks module does not start a save while an earlier one runs.
 */
export function paneModuleOf<
  View extends JsonValue,
  Local extends JsonValue,
  Action extends JsonValue,
  Result extends JsonValue,
>(
  machine: PaneMachine<View, Local, Action, Result>,
): ClientModule<PaneProps<View, Result>, ModuleState<Local, Action>> {
  return (props, surface) => {
    // The module state as every step of this call and of the events drawn by it left it. The
    // engine contract does not say that `surface.state` shows a `setState` before the next call.
    let latest = moduleStateOfSession(machine.initial, surface.state, props.sessionId)
    const store = (next: ModuleState<Local, Action>) => {
      latest = next
      surface.setState(next)
    }
    const settled = settledState(machine.settle, latest.pane, props.answers)
    if (latest !== surface.state || settled !== latest.pane) {
      store({ ...latest, pane: settled })
    }
    const keyboardStore: KeyboardStore = {
      read: () => latest.keyboard,
      update: change => {
        const keyboard = change(latest.keyboard)
        if (keyboard !== latest.keyboard) {
          store({ ...latest, keyboard })
        }
      },
    }
    const apply = (step: PaneStep<Local, Action>, actionId: string) =>
      store({
        ...latest,
        pane: steppedState(latest.pane, step, actionId),
        focusAsk: step.opensField === true ? crypto.randomUUID() : latest.focusAsk,
      })
    const drawWith = (
      act: PaneControls<Local, Action>['act'],
      saveTyped: PaneControls<Local, Action>['saveTyped'],
    ) => {
      const { elements, tabOrder } = drawnControlsOf(surface.elements, keyboardStore)
      const pane = { local: latest.pane.local, saves: shownSavesOf(latest), act, saveTyped }
      // The module draws its dropdowns from Button and Text, and the hooks module draws its text
      // fields, on every surface.
      const { drawn, fields } = drawCollectingFields(elements, all =>
        machine.draw(props.view, pane, { elements: all, drawsFields: true }),
      )

      return { drawn, fields, tabOrder }
    }
    const submit = (event: Extract<FieldEvent, { kind: FieldEventKind.Submit }>) => {
      // Each Enter puts one save on the queue at most, so the id of the event names it.
      const { fields } = drawWith(
        press => apply(press(latest.pane.local), event.eventId),
        save => apply(stepOfSave(save(latest.pane.local, event.typed)), event.eventId),
      )
      fields.find(({ shown }) => shown.key === event.field)?.onSubmit(event.text)
    }
    const runWaitingPress = ({ eventId, typed }: FieldEvent) => {
      const press = latest.waiting.find(({ pressId }) => pressId === eventId)
      if (press !== undefined) {
        store({
          ...latest,
          pane: steppedState(latest.pane, stepOfSave(press.save(press.local, typed)), eventId),
          waiting: latest.waiting.filter(each => each !== press),
        })
      }
    }
    for (const event of eventsAfter(props.fieldEvents, latest.appliedFieldEvent)) {
      switch (event.kind) {
        case FieldEventKind.Submit:
          submit(event)
          break
        case FieldEventKind.Press:
          runWaitingPress(event)
          break
      }
      store({ ...latest, appliedFieldEvent: event.number })
    }
    const { drawn, fields, tabOrder } = drawWith(
      press => apply(press(latest.pane.local), crypto.randomUUID()),
      save =>
        store({
          ...latest,
          waiting: [
            ...latest.waiting,
            { pressId: crypto.randomUUID(), local: latest.pane.local, save },
          ],
        }),
    )
    const keyboard = keyboardAfterDrawing(tabOrder, latest.keyboard)
    if (keyboard !== latest.keyboard) {
      store({ ...latest, keyboard })
    }
    const post = postOf(latest, fields)
    if (!isPosted(post, latest.posted)) {
      surface.post(post)
      store({ ...latest, posted: post })
    }
    // The listener set by the next call replaces this one, so the function returned to clear it is
    // not needed.
    surface.onKey(event => sendKeyToFocusedControl(tabOrder, keyboardStore, event))

    return drawn
  }
}
