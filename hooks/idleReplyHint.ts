import type { HintKind } from './hintKind'
import { CHECK_FOR_OPEN_WORK, OPTIMIZE_IDLE_TIME } from './openWork'

/** A reply made only of "all is well", such as "All clear", "Everything’s fine" or "All set". */
const ALL_IS_WELL =
  String.raw`(?:everything|all)(?:['’]s|\s+is)?\s+` +
  String.raw`(?:clear|fine|good|healthy|quiet|ok(?:ay)?|well|set)|fine`

/** A reply made only of "nothing is there", such as "Nothing new" or "No change". */
const NOTHING_THERE =
  String.raw`nothing\s+(?:(?:left\s+)?to\s+(?:do|report)|new|(?:has\s+)?changed|pending|open)|` +
  String.raw`no\s+(?:changes?|news)`

/** A reply made only of the waiting itself, such as "Standing by". */
const STANDING_BY = String.raw`idle|standing\s+by`

/** One idle reply, with an optional "still" before it, such as "Still nothing new". */
const IDLE_REPLY = String.raw`(?:still\s+)?(?:${ALL_IS_WELL}|${NOTHING_THERE}|${STANDING_BY})`

/** A stop, an exclamation mark or an ellipsis, which can end the message. */
const END_MARK = String.raw`[.!]|\.{3}|…`

/**
 * What stands between two replies: a mark, with any spaces and an "and" after it, or spaces with an
 * optional "and". No reply starts with a space or a mark, so every boundary has one way to match,
 * and a long run of replies before other text fails in time linear in its length.
 */
const BETWEEN_REPLIES = String.raw`\s*(?:${END_MARK}|[,;—–-])\s*(?:and\s+)?|\s+(?:and\s+)?`

/** A whole message made of one or more idle replies, such as "No change. Nothing to do." */
const IDLE_MESSAGE =
  String.raw`^\s*${IDLE_REPLY}(?:(?:${BETWEEN_REPLIES})${IDLE_REPLY})*(?:\s*(?:${END_MARK}))?\s*$`

/** The hint after a message made only of idle replies, which shows that the session did not look
 * for work. */
export const IDLE_REPLY_HINT: HintKind = {
  phrases: [new RegExp(IDLE_MESSAGE, 'i')],
  text:
    `Looks like you're idling. ${CHECK_FOR_OPEN_WORK} Work toward the open goals. Check whether ` +
    `the user gave an instruction for idle time, and follow it. ${OPTIMIZE_IDLE_TIME}`,
}
