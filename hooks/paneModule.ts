import type { ClientModule, JsonValue, RenderElement } from 'claude-code'

import { drawnControlsOf } from './clientControls'
import {
  NEW_KEYBOARD,
  keyboardAfterDrawing,
  sendKeyToFocusedControl,
  sendPointerToPane,
} from './paneKeyboard'
import type { KeyboardStore, PaneKeyboard } from './paneKeyboard'
import type { PaneElements } from './paneElements'

// A pane drawn by a surface module reacts to every press on the drawing thread, while the worker
// of the hooks module may be busy with the hooks run for every agent in the session. The module
// stores what a press changes in its own state, and puts each save on a queue, in order. Every
// post contains every save of the queue not answered yet, so a post replaced by a later one in the
// same frame loses no save. The hooks module runs each save once, in order, and records its
// result. Every drawing of the pane contains the recent results, which end the saves they answer.

/** A save made by a pane, under an id new to the save, which its result repeats. */
export type PaneSave<Action> = { actionId: string; action: Action }

/**
 * What a pane module posts: the session in which its saves were made, and every save of its queue
 * not answered yet, in order.
 */
export type PanePost<Action> = { sessionId: string; saves: readonly PaneSave<Action>[] }

/** The result of the save made under `actionId`. */
export type PaneAnswer<Result> = { actionId: string; result: Result }

/**
 * What the hooks module sends to a pane: the session that runs, what to draw, and the results of
 * the recent saves of the pane.
 */
export type PaneProps<View, Result> = {
  sessionId: string
  view: View
  answers: readonly PaneAnswer<Result>[]
}

/** The texts typed into the fields of a pane, by the key of the field. */
export type TypedTexts = Readonly<Record<string, string>>

/**
 * The state of a pane in the session `sessionId`: the state of its presses, the texts typed into
 * its fields, and its saves not answered yet, in order.
 */
export type PaneState<Local, Action> = {
  sessionId: string
  local: Local
  typed: TypedTexts
  queue: readonly PaneSave<Action>[]
}

/** What a press does: the next state of the presses, and the save it puts on the queue, if any. */
export type PaneStep<Local, Action> = { local?: Local; save?: Action }

/** A press: the step it computes from the state of the presses and the texts typed, as they are. */
export type PanePress<Local, Action> = (local: Local, typed: TypedTexts) => PaneStep<Local, Action>

/** What the drawing of a pane reads and acts on. */
export type PaneControls<Local, Action> = {
  local: Local
  /** The saves not answered yet, in order: the first runs, and the others wait for it. */
  saves: readonly Action[]
  /** Applies the step that `press` computes from the state of the pane as it is at the press. */
  act: (press: PanePress<Local, Action>) => Promise<void> | void
  /**
   * Records `text` as typed into the field `field`. The field shows its text itself, so the
   * drawing of the pane does not change.
   */
  type: (field: string, text: string) => Promise<void> | void
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
  return state?.sessionId === sessionId
    ? state
    : { sessionId, local: initial, typed: {}, queue: [] }
}

/** `state` after `press`, with the save it puts on the queue under `actionId`, if any. */
export function steppedState<Local, Action>(
  state: PaneState<Local, Action>,
  press: PanePress<Local, Action>,
  actionId: string,
): { state: PaneState<Local, Action>; queued: PaneSave<Action> | undefined } {
  const next = press(state.local, state.typed)
  const queued = next.save === undefined ? undefined : { actionId, action: next.save }

  return {
    state: {
      ...state,
      local: 'local' in next ? next.local : state.local,
      queue: queued === undefined ? state.queue : [...state.queue, queued],
    },
    queued,
  }
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

/** The state of a pane in its surface module: the state of its presses, and its keyboard. */
export type ModuleState<Local, Action> = { pane: PaneState<Local, Action>; keyboard: PaneKeyboard }

/**
 * The surface module that draws `machine`, with the state of the presses and of the keyboard
 * stored on the drawing thread. A press that queues a save posts the queue. A result that ends a
 * save posts the saves left, since the hooks module does not start a save while an earlier one
 * runs.
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
    const shown = stateOfSession(machine.initial, surface.state?.pane, props.sessionId)
    const state = settledState(machine.settle, shown, props.answers)
    const postQueue = ({ sessionId, queue }: PaneState<Local, Action>) =>
      surface.post({ sessionId, saves: queue })
    if (state !== shown && state.queue.length > 0) {
      postQueue(state)
    }
    // The module state as every step of this call and of the events drawn by it left it. The
    // engine contract does not say that `surface.state` shows a `setState` before the next call.
    let latest: ModuleState<Local, Action> = {
      pane: state,
      keyboard: surface.state?.keyboard ?? NEW_KEYBOARD,
    }
    const store = (next: ModuleState<Local, Action>) => {
      latest = next
      surface.setState(next)
    }
    const act = (press: PanePress<Local, Action>) => {
      const stepped = steppedState(latest.pane, press, crypto.randomUUID())
      store({ ...latest, pane: stepped.state })
      if (stepped.queued !== undefined) {
        postQueue(stepped.state)
      }
    }
    const type = (field: string, text: string) =>
      store({ ...latest, pane: { ...latest.pane, typed: { ...latest.pane.typed, [field]: text } } })
    const keyboardStore: KeyboardStore = {
      read: () => latest.keyboard,
      update: change => {
        const keyboard = change(latest.keyboard)
        if (keyboard !== latest.keyboard) {
          store({ ...latest, keyboard })
        }
      },
    }
    const { elements, tabOrder } = drawnControlsOf(surface.elements, keyboardStore)
    const pane = { local: state.local, saves: state.queue.map(({ action }) => action), act, type }
    // The module draws its text inputs and dropdowns from Button and Text, on every surface.
    const drawn = machine.draw(props.view, pane, { elements, drawsFields: true })
    const keyboard = keyboardAfterDrawing(tabOrder, latest.keyboard)
    if (state !== surface.state?.pane || keyboard !== latest.keyboard) {
      store({ pane: state, keyboard })
    }
    // The listener set by the next call replaces this one, so the function returned to clear it is
    // not needed.
    surface.onKey(event => sendKeyToFocusedControl(tabOrder, keyboardStore, event))
    surface.onPointer(event => sendPointerToPane(keyboardStore, event))

    return drawn
  }
}
