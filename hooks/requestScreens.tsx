import type { ElementTable, EngineInterface, MatchedHook, ResolveInput } from 'claude-code'

import type { Reply, Request } from '../types'
import { recordReplyAndDeliver } from './delivery'
import { replyOf, replyUsage } from './inputs'
import { ALL_CLOSED } from './modelText'
import { REPLY_COMMAND, REQUESTS_PANE } from './names'
import { sortedByNumber } from './numbered'
import { describePaneNotOpened } from './paneOpening'
import type { PaneOpener } from './paneOpening'
import { openRequestsOf } from './requests'
import { sessionForUse } from './requestSession'
import { toastStoreFailure } from './requestStoreFailure'
import { REQUESTS_PANE_TITLE } from './requestTexts'
import { loadRequestsFromStore, readRequestsInState } from './sessionState'
import { drawsFields } from './surfaces'
import type { SurfaceWithFields } from './surfaces'

const OPEN_BUTTON = 'Open'

export const drawRequestBand: MatchedHook<'ui.render', { component: 'AbovePrompt' }> = async (
  $,
  e,
  next,
) => {
  const open = await readOpenRequests($)
  if (e.props.hasSurvey || open.length === 0) {
    return next(e)
  }
  const { Box, Button, Text } = $.ui.resolve(e)

  return (
    <Box>
      <Text>{open.length === 1 ? '1 open request ' : `${open.length} open requests `}</Text>
      <Button
        key="open"
        label={OPEN_BUTTON}
        onPress={() => toastStoreFailure($, () => showPane($))}
      />
    </Box>
  )
}

export const drawRequestPane: MatchedHook<
  'ui.render',
  { component: 'Pane'; requestId: typeof REQUESTS_PANE }
> = async ($, e) => {
  const open = sortedByNumber(await readOpenRequests($))
  const { Box, Text } = $.ui.resolve(e)
  if (open.length === 0) {
    return <Text dimColor>{ALL_CLOSED}</Text>
  }

  return (
    <Box flexDirection="column">
      {open.map(request => (
        <Box flexDirection="column" marginBottom={1}>
          <Text bold>{`#${request.number} ${request.text}`}</Text>
          {drawsFields(e)
            ? drawDoneFields($, e, request)
            : drawReplyCommand({ Text }, request)}
        </Box>
      ))}
    </Box>
  )
}

/**
 * The Done button, which marks the request done without a reply, and the field for a reply, which
 * marks it done with the reply typed. Enter in a blank field marks nothing.
 */
function drawDoneFields(
  $: EngineInterface,
  e: ResolveInput<'Pane', SurfaceWithFields>,
  request: Request,
) {
  const { Box, Button, Input } = $.ui.resolve(e)
  const markDone = (reply: Pick<Reply, 'text'>) =>
    toastStoreFailure($, () => markDoneOnScreen($, request, reply))

  return (
    <Box>
      <Button key={`done-${request.number}`} label="Done" onPress={() => markDone({})} />
      <Input
        key={`reply-${request.number}`}
        placeholder="Or type a reply"
        submitLabel="done"
        onSubmit={text => {
          const reply = replyOf(text)

          return reply.text === undefined ? undefined : markDone(reply)
        }}
      />
    </Box>
  )
}

/** The /reply command for the request, where no field can mark it done. */
function drawReplyCommand({ Text }: Pick<ElementTable, 'Text'>, request: Request) {
  return <Text dimColor>{`Mark done with ${replyUsage(request.number)}`}</Text>
}

/** The open requests in the state of the session that runs, which a drawing cannot load. */
async function readOpenRequests($: EngineInterface): Promise<Request[]> {
  return openRequestsOf((await readRequestsInState($))?.requests ?? [])
}

async function showPane($: EngineInterface): Promise<void> {
  await loadRequestsFromStore($, await sessionForUse($))
  const notOpened = await openRequestsPane($, { button: OPEN_BUTTON })
  if (notOpened !== undefined) {
    $.ui.toast(
      `${notOpened} Mark one done with ${replyUsage()}, or list them with /${REPLY_COMMAND}.`,
    )
  }
}

/** Opens the Requests pane, and returns why it did not open, undefined once it opened. */
export async function openRequestsPane(
  $: EngineInterface,
  opener: PaneOpener,
): Promise<string | undefined> {
  const opened = await $.ui.open({ id: REQUESTS_PANE, title: REQUESTS_PANE_TITLE, focus: true })
  if (opened.isPlaced) {
    return undefined
  }

  return describePaneNotOpened(REQUESTS_PANE_TITLE, opened.reason, opener)
}

async function markDoneOnScreen(
  $: EngineInterface,
  request: Request,
  reply: Pick<Reply, 'text'>,
): Promise<void> {
  const sessionId = await sessionForUse($)
  // The request is marked done with the id that the pane drew. Ids differ across sessions, so a
  // press after a switch to another session cannot reach its requests.
  const isOpen = await recordReplyAndDeliver($, sessionId, open => open.id === request.id, reply)
  if (!isOpen) {
    $.ui.toast(`Request #${request.number} is no longer open.`)
  }
}
