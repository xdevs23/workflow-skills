import { RecordKind, isRecord, recordKeyOf } from '../pluginStore'

// The version of the records written by this code. A record of a higher version was written by a
// newer plugin with fields this code can misread, so it reads as unreadable and is left as it is.
const RECORD_VERSION = 1

// The store has the records of every session of every project in one file capped at 4 MiB, so a
// prompt pasted whole would take the space of other records. A product choice: the first 200
// characters tell the sessions in a list apart, and the import pane cuts the line to the screen.
const FIRST_PROMPT_MAX_LENGTH = 200

/** The records of a session, each written once by the session, by the last part of its key. */
enum SessionPart {
  Start = 'start',
  FirstPrompt = 'first-prompt',
}

/** Where and when a session began: the project folder it started in, and the time it started. */
export type SessionStart = { root: string; startedAt: number }

export function startKeyOf(sessionId: string): string {
  return recordKeyOf(RecordKind.Session, sessionId, SessionPart.Start)
}

export function firstPromptKeyOf(sessionId: string): string {
  return recordKeyOf(RecordKind.Session, sessionId, SessionPart.FirstPrompt)
}

export function startValueOf(start: SessionStart): { version: number } & SessionStart {
  return { version: RECORD_VERSION, ...start }
}

export function firstPromptValueOf(text: string): { version: number; text: string } {
  return { version: RECORD_VERSION, text }
}

/** Reads a start record, or undefined for a value of another shape or a higher version. */
export function parseStart(value: unknown): SessionStart | undefined {
  if (!isRecord(value) || value.version !== RECORD_VERSION) {
    return undefined
  }
  const { root, startedAt } = value

  return typeof root === 'string' && typeof startedAt === 'number' ? { root, startedAt } : undefined
}

/** Reads a first prompt record, or undefined for a value of another shape or a higher version. */
export function parseFirstPrompt(value: unknown): string | undefined {
  return isRecord(value) && value.version === RECORD_VERSION && typeof value.text === 'string'
    ? value.text
    : undefined
}

/**
 * The first prompt of a session as its record has it: `prompt` on one line, with each run of white
 * space made one space, cut to its first characters. Counted in code points, so a cut never splits
 * a character.
 */
export function firstPromptOf(prompt: string): string {
  return [...prompt.replace(/\s+/gu, ' ').trim()].slice(0, FIRST_PROMPT_MAX_LENGTH).join('')
}
