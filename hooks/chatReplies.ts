import type { MatchedHook, On, PromptComposeSection } from 'claude-code'

import { PLUGIN } from './names'

const CHAT_REPLIES: PromptComposeSection = {
  id: `${PLUGIN}:chat-replies`,
  text: [
    '# How you talk in chat',
    '',
    'These rules cover your replies in chat. Files, commits and text for other people follow ' +
      'other rules.',
    '',
    '- Answer the whole question in the first line: yes or no, the number, or the verdict.',
    '- Give each reason one bullet. Start the bullet with a short bold label that states the ' +
      'reason. Then say what the code does, with the file and line you read.',
    '- Use the names from the code and the numbers you measured.',
    '- Say what you did, what you found and what the user needs to decide.',
    '- End on the last reason. Do not offer more work.',
    '',
    'Asked "Can we use tokio instead of the extra thread, or is that too much scope creep?":',
    '',
    "We can, but it's too much scope creep. It wouldn't save a thread either:",
    '',
    '- **Not in the workspace:** `Cargo.toml` does not list `tokio`. The async code already runs ' +
      'on `futures-lite` (`Cargo.toml:131`). Moving to `tokio` would change dependencies across ' +
      'the workspace.',
    '- **Same thread requirement:** `serve` in `run.rs:167` blocks the main thread in the event ' +
      'loop. A `tokio` runtime would still need a worker pool or a separate thread.',
    '- **No new dependency with one thread:** one thread running `futures-lite` can poll every ' +
      'desktop source while the display runs, and stop when the app exits.',
  ].join('\n'),
  scope: 'shared',
}

// The engine sections that carry the tone: `tone` in the full system prompt, `lean_body` in the
// short one. The section on chat replies follows whichever of them the prompt holds.
const SECTIONS_WITH_TONE: readonly string[] = ['tone', 'lean_body']

/**
 * Registers the hook that puts the section on chat replies right after the section carrying the
 * tone of every system prompt rendered for the default output style, except the one-line prompt.
 */
export function registerChatReplies(on: On): void {
  on('prompt.compose', { outputStyle: null }, addChatReplies)
}

const addChatReplies: MatchedHook<'prompt.compose', { outputStyle: null }> = async (
  $,
  e,
  next,
) => {
  const composed = await next(e)
  if (e.traits.includes('bare')) {
    return composed
  }
  const { sections } = composed
  const tone = sections.findIndex(section => SECTIONS_WITH_TONE.includes(section.id))
  if (tone === -1) {
    // The engine reports a hook that throws after `next(e)` and sends the prompt `next` answered.
    throw new Error(
      `The system prompt has none of the sections ${SECTIONS_WITH_TONE.join(', ')} ` +
        `(traits: ${e.traits.join(', ')}), so the section on chat replies is left out.`,
    )
  }
  const position = tone + 1

  return { sections: [...sections.slice(0, position), CHAT_REPLIES, ...sections.slice(position)] }
}
