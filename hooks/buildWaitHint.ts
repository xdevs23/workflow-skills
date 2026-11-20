import { HintKindName } from './hintKind'
import type { HintKind } from './hintKind'
import { phrase } from './phrase'

/** A word of the clause. It is never "to", so "the user to build" names no build. */
const WORD = String.raw`(?!to\b)[^\s.!?,;:]+`
/** A build named by up to two words or by its number, such as "a Pong build" or "build 426", and
 * never a part of one, such as "the build step" or "the build of the graph". */
const BUILD =
  String.raw`(?:(?:a|the)\s+(?:${WORD}\s+){0,2})?build(?:\s+#?\d+)?\b` +
  String.raw`(?!\s+(?:to|of|steps?|outputs?)\b)`
const BUILD_ENDS =
  String.raw`(?:ends|finishes|completes|is\s+(?:done|finished|complete)|` +
  String.raw`has\s+(?:ended|finished|completed))`
/** Work that waits for a later moment, such as "starts" or "I'll merge". */
const WORK_THAT_WAITS =
  String.raw`(?:starts?|begins?|waits?|resumes?|continues?|follows?|I['’]ll\s+\w+|I\s+will\s+\w+)`

/** The hint after a message that reports work as waiting on a build. */
export const BUILD_WAIT_HINT: HintKind<HintKindName.BuildWait> = {
  name: HintKindName.BuildWait,
  phrases: [
    phrase(String.raw`\b(?:waits?|waiting)\s+(?:on|for)\s+${BUILD}`),
    phrase(
      String.raw`\b${WORK_THAT_WAITS}(?:\s+${WORD}){0,4}\s+(?:after|once|until)\s+${BUILD}\s+` +
        String.raw`${BUILD_ENDS}\b`,
    ),
    /\b(?:get|gets|will\s+be|to\s+be)\s+proven\s+by\s+the\s+build\b/i,
  ],
  text: [
    'Go on now with work that does not need the result of the build. Check whether the build is ' +
      'running and whether restarting the build to include the new changes makes sense and is ' +
      'permissible.',
  ],
}
