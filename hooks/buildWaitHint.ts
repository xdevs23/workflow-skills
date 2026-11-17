import type { HintKind } from './hintKind'

/** The hint after a message that reports work as waiting on a build. */
export const BUILD_WAIT_HINT: HintKind = {
  phrases: [/\bwaits\s+on\s+(?:a|the)\s+build\b/i],
  text: [
    'Check whether the build is running and whether it makes sense and is permissible to ' +
      'restart the build to include the new changes.',
  ],
}
