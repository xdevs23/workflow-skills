import type { EngineInterface } from 'claude-code'

import type { Reply, Request } from '../types'
import { PendingTextPlace, submitAddedText } from './pendingTexts'
import type { PendingTextSource } from './pendingTexts'
import { describeReplies, describeRepliesNote } from './modelText'
import { undeliveredRepliesOf } from './requests'
import type { DoneRequest } from './requests'
import { awaitingSessionOf } from './requestSession'
import { saveDelivery, saveReply } from './requestStore'
import { handleStoreFailure, toastStoreFailure } from './requestStoreFailure'
import { PromptOutcome, isPromptEntered, submitToSession } from './sendToModel'
import type { Delivery, TextWithLine } from './sendToModel'
import {
  claimReplies,
  loadRequestsFromStore,
  releaseReplies,
  setRequestsInState,
  updateRequests,
} from './sessionState'

/**
 * Hands the replies not yet read by the session `sessionId` to `send`, together with the requests
 * of that session, and stores them as delivered once `send` reports them accepted. `send` runs also
 * when the list of replies is empty. Replies another delivery of the session is sending
 * are left to that delivery, so parallel tool calls give each reply to the model once.
 */
export async function deliverReplies<T>(
  $: EngineInterface,
  sessionId: string,
  send: (
    done: readonly DoneRequest[],
    requests: readonly Request[],
  ) => Promise<Delivery<T>>,
): Promise<T> {
  const requests = await loadRequestsFromStore($, sessionId)
  const done = await claimReplies($, undeliveredRepliesOf(requests))
  try {
    const delivery = await send(done, requests)
    if (delivery.isAccepted && done.length > 0) {
      await storeDelivery($, sessionId, done)
    }

    return delivery.result
  } finally {
    if (done.length > 0) {
      await releaseReplies($, done)
    }
  }
}

/**
 * Stores the replies as delivered. A refused write leaves them undelivered, so the model reads
 * them again with a later delivery, and the user is told.
 */
async function storeDelivery(
  $: EngineInterface,
  sessionId: string,
  done: readonly DoneRequest[],
): Promise<void> {
  await toastStoreFailure($, async () => {
    const delivered = await saveDelivery($, sessionId, done)
    await updateRequests($, requests =>
      requests.map(request => delivered.find(each => each.id === request.id) ?? request),
    )
  })
}

/**
 * Marks the open request of the session `sessionId` that `which` selects done with the reply of
 * the user, if any, and returns whether such a request was open. The request marked done goes to
 * the model as `submitAddedText` describes.
 */
export async function recordReplyAndDeliver(
  $: EngineInterface,
  sessionId: string,
  which: (request: Request) => boolean,
  typed: Pick<Reply, 'text'>,
): Promise<boolean> {
  const reply = { ...typed, repliedAt: await $.clock.now() }
  const { done, requests } = await saveReply($, sessionId, which, reply)
  await setRequestsInState($, sessionId, requests)
  if (done !== undefined) {
    submitAddedText($, repliesSource($))
  }

  return done !== undefined
}

/** The replies to the requests of the session, as a source of texts sent to the model. */
export function repliesSource($: EngineInterface): PendingTextSource {
  return {
    takeNote: () => takeRepliesNote($),
    submit: () => submitReplies($),
    describeNotSent: describeRepliesNotSent,
    waitingAfterStopToast: REPLIES_WAITING_AFTER_STOP,
    describeWaitingForPane: describeRepliesWaitingForPane,
  }
}

const REPLIES_WAITING_AFTER_STOP =
  'The request you marked done goes to Claude once you type a slash command or send a message.'

function describeRepliesWaitingForPane(paneTitle: string): string {
  return (
    `The request you marked done goes to Claude once you close the ${paneTitle} pane or send a ` +
    'message.'
  )
}

/** The toast for replies left unsent for `reason`. */
function describeRepliesNotSent(reason: string): string {
  return (
    `This plugin could not tell Claude which requests you marked done: ${reason}. ` +
    'It sends them with your next prompt or the next tool result.'
  )
}

async function takeRepliesNote($: EngineInterface): Promise<TextWithLine | undefined> {
  const sessionId = await awaitingSessionOf($)
  if (sessionId === null) {
    return undefined
  }

  return handleStoreFailure(
    $,
    () =>
      deliverReplies($, sessionId, async done => ({
        result:
          done.length === 0
            ? undefined
            : describeRepliesNote(PendingTextPlace.ToolResult, done),
        isAccepted: true,
      })),
    message => {
      $.ui.toast(message)

      return undefined
    },
  )
}

/**
 * Sends the undelivered replies of the session awaiting replies to the model as a prompt in the
 * name of the user, and stores them as delivered once the prompt is accepted. The delivery skips
 * replies already delivered, so a delivery started while another one runs sends each reply once.
 */
async function submitReplies($: EngineInterface): Promise<void> {
  const sessionId = await awaitingSessionOf($)
  if (sessionId === null) {
    return
  }
  await deliverReplies($, sessionId, async done => {
    if (done.length === 0) {
      return { result: undefined, isAccepted: false }
    }
    const text = describeReplies(done)
    const submitted = await submitToSession($, sessionId, { text, asUser: true })
    if (submitted.outcome === PromptOutcome.Dropped) {
      $.ui.toast(describeRepliesNotSent(submitted.reason))
    }

    return { result: undefined, isAccepted: isPromptEntered(submitted) }
  })
}
