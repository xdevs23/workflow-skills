import type {
  EngineInterface,
  HookStream,
  ProcessSpawnChunk,
  ProcessSpawnResult,
} from 'claude-code'

import { claudeConfigFolderOf } from '../claudeConfigFolder'
import { readJsonText } from '../jsonText'
import { isRecord } from '../pluginStore'
import { firstPromptOf, isSlashCommandText } from './sessionRecord'
import type { RecordedStart } from './sessionStore'

// Claude Code writes every prompt typed as one JSON line to history.jsonl in its configuration
// folder, oldest first. The format is not documented by Claude Code. Checked on 2026-11-14 with
// Claude Code 2.1.321: `display` is the prompt, `timestamp` is the time in milliseconds, `project`
// is the folder where the session ran, and `sessionId` is the id of the session. Lines written by
// older versions do not have `sessionId`. `display` has a placeholder such as
// [Pasted text #1 +40 lines] for each text pasted into the prompt, and `pastedContents` has that
// text by its number, as `content`, or as `contentHash`, the name of a file in paste-cache.
const PROMPT_HISTORY_FILE = 'history.jsonl'
const PASTE_CACHE_FOLDER = 'paste-cache'

// The placeholder of a pasted text in `display`, with the number of the text.
const PASTE_PLACEHOLDER = /\[Pasted text #(\d+)[^\]]*\]/gu

// The exit status of grep is 1 when the search does not match any line. A higher one is an error.
const GREP_NO_MATCH = 1

/** The outcome of an attempt to read the prompt history of Claude Code. */
export enum HistoryOutcome {
  Read = 'read',
  /** Neither CLAUDE_CONFIG_DIR nor HOME is set, so the configuration folder is not known. */
  NoConfigFolder = 'no-config-folder',
  /**
   * grep could not start or failed on the history, such as on a missing file, or a pasted text
   * could not be read, with the file and the error.
   */
  Failed = 'failed',
}

export type PromptHistoryRead =
  | {
      outcome: HistoryOutcome.Read
      starts: ReadonlyMap<string, RecordedStart>
      /** The number of lines found by grep in a shape that this code does not read. */
      unreadableLines: number
    }
  | { outcome: HistoryOutcome.NoConfigFolder }
  | { outcome: HistoryOutcome.Failed; path: string; error: string }

/** A text pasted into a prompt, as the prompt history of Claude Code records it. */
type PastedText = { content: string } | { contentHash: string }

/** A prompt as the prompt history of Claude Code records it, with its pasted texts by number. */
type HistoryLine = {
  display: string
  pastes: ReadonlyMap<string, PastedText>
  timestamp: number
  project: string
  sessionId: string
}

/** A line written by grep, with the stream it came from. */
type OutputLine = { stream: ProcessSpawnChunk['stream']; line: string }

/**
 * A rejection by the engine of a call made to read the file `path`, such as a run of grep that
 * cannot start.
 */
class HistoryReadError extends Error {
  readonly path: string

  constructor(path: string, cause: Error) {
    super(cause.message, { cause })
    this.path = path
  }
}

/**
 * The start of each session named in `sessionIds` found in the prompt history of Claude Code: the
 * folder and the time of its first line, and its first prompt. A session missing from the history
 * is left out.
 */
export async function readStartsFromPromptHistory(
  $: EngineInterface,
  sessionIds: readonly string[],
): Promise<PromptHistoryRead> {
  if (sessionIds.length === 0) {
    return { outcome: HistoryOutcome.Read, starts: new Map(), unreadableLines: 0 }
  }
  const configFolder = await claudeConfigFolderOf($)
  if (configFolder === undefined) {
    return { outcome: HistoryOutcome.NoConfigFolder }
  }
  const path = `${configFolder}/${PROMPT_HISTORY_FILE}`
  // The history outgrows the 4 MiB read by $.fs.read, so grep returns the lines that contain the
  // ids of the sessions. Its output is read as it arrives, since those lines can outgrow the 4 MiB
  // of output returned by $.process.run.
  const grep = $.process.spawn({
    argv: ['grep', '-F', ...sessionIds.flatMap(id => ['-e', id]), '--', path],
  })
  const asked = new Set(sessionIds)
  const starts = new Map<string, RecordedStart>()
  const errorLines: string[] = []
  let unreadableLines = 0
  try {
    for await (const { stream, line } of outputLinesOf(grep, path)) {
      if (stream === 'stderr') {
        errorLines.push(line)
        continue
      }
      const read = readJsonText(line, toHistoryLine)
      if (!read.isRead) {
        unreadableLines += 1
      } else if (asked.has(read.model.sessionId)) {
        await addToStarts($, `${configFolder}/${PASTE_CACHE_FOLDER}`, starts, read.model)
      }
    }
  } catch (error) {
    if (!(error instanceof HistoryReadError)) {
      throw error
    }

    return { outcome: HistoryOutcome.Failed, path: error.path, error: error.message }
  }
  const { code } = await grep.result
  if (code === null || code > GREP_NO_MATCH) {
    return { outcome: HistoryOutcome.Failed, path, error: errorLines.join('\n') }
  }

  return { outcome: HistoryOutcome.Read, starts, unreadableLines }
}

/**
 * The lines written by `grep` run on the file `path`, in the order written. A rejection of the run
 * by the engine fails as a HistoryReadError.
 */
async function* outputLinesOf(
  grep: HookStream<ProcessSpawnChunk, ProcessSpawnResult>,
  path: string,
): AsyncGenerator<OutputLine> {
  const unfinished: Record<OutputLine['stream'], string> = { stdout: '', stderr: '' }
  try {
    for await (const { stream, text } of grep) {
      const lines = `${unfinished[stream]}${text}`.split('\n')
      unfinished[stream] = lines.pop() ?? ''
      yield* lines.map(line => ({ stream, line }))
    }
  } catch (error) {
    if (!(error instanceof Error)) {
      throw error
    }
    throw new HistoryReadError(path, error)
  }
  for (const stream of ['stdout', 'stderr'] as const) {
    if (unfinished[stream] !== '') {
      yield { stream, line: unfinished[stream] }
    }
  }
}

/**
 * Adds `line` to `starts`, which has the start made of the lines written before it, with the pasted
 * texts kept in files in `pasteFolder`.
 */
async function addToStarts(
  $: EngineInterface,
  pasteFolder: string,
  starts: Map<string, RecordedStart>,
  line: HistoryLine,
): Promise<void> {
  const start = starts.get(line.sessionId) ?? { root: line.project, startedAt: line.timestamp }
  const firstPrompt =
    start.firstPrompt ??
    firstPromptOf({
      text: await promptWithPastesOf($, pasteFolder, line),
      runsCommand: isSlashCommandText(line.display),
    })
  starts.set(line.sessionId, firstPrompt === undefined ? start : { ...start, firstPrompt })
}

/**
 * The prompt of `line` as typed, with each placeholder of a pasted text replaced by that text. A
 * placeholder stays where the text is gone, such as from a paste-cache cleaned up since.
 */
async function promptWithPastesOf(
  $: EngineInterface,
  pasteFolder: string,
  { display, pastes }: HistoryLine,
): Promise<string> {
  const texts = new Map(
    await Promise.all(
      [...pastes].map(async ([number, pasted]) => {
        const text = await pastedTextOf($, pasteFolder, pasted)

        return [number, text] as const
      }),
    ),
  )

  return display.replace(
    PASTE_PLACEHOLDER,
    (placeholder, number: string) => texts.get(number) ?? placeholder,
  )
}

/** The text of `pasted`, or undefined when its file in `pasteFolder` is gone. */
async function pastedTextOf(
  $: EngineInterface,
  pasteFolder: string,
  pasted: PastedText,
): Promise<string | undefined> {
  if ('content' in pasted) {
    return pasted.content
  }
  const path = `${pasteFolder}/${pasted.contentHash}.txt`
  try {
    return (await $.fs.exists(path)) ? await $.fs.read(path) : undefined
  } catch (error) {
    if (!(error instanceof Error)) {
      throw error
    }
    throw new HistoryReadError(path, error)
  }
}

/**
 * `value` as a line of the prompt history, or undefined for a value of another shape, such as a
 * line written by an older version.
 */
function toHistoryLine(value: unknown): HistoryLine | undefined {
  if (!isRecord(value)) {
    return undefined
  }
  const { display, pastedContents, timestamp, project, sessionId } = value

  return typeof display === 'string' &&
    typeof timestamp === 'number' &&
    typeof project === 'string' &&
    typeof sessionId === 'string'
    ? { display, pastes: parsePastedTexts(pastedContents), timestamp, project, sessionId }
    : undefined
}

/** The pasted texts among `value` by number, without an entry of another shape. */
function parsePastedTexts(value: unknown): Map<string, PastedText> {
  const pastes = new Map<string, PastedText>()
  for (const [number, entry] of Object.entries(isRecord(value) ? value : {})) {
    if (!isRecord(entry) || entry.type !== 'text') {
      continue
    }
    const { content, contentHash } = entry
    if (typeof content === 'string') {
      pastes.set(number, { content })
    } else if (typeof contentHash === 'string') {
      pastes.set(number, { contentHash })
    }
  }

  return pastes
}
