/** What the user wrote in reply to a question. */
export type Answer = {
  text: string
  answeredAt: number
  /** Whether the asking session has read the answer, from a tool result, a prompt or the list. */
  isDelivered: boolean
}

/** A question the model put to the user, stored until the user answers it. */
export type Question = {
  /** The part of the store key that names the question, unique across every session. */
  id: string
  /** The number the user and the model name the question by, unique in its project. */
  number: number
  /** The session that asked the question, the only one its answer is delivered to. */
  sessionId: string
  text: string
  /** The answers the user can pick from; empty for a question answered in words alone. */
  choices: readonly string[]
  askedAt: number
  answer?: Answer
  /** When the asking session took the question back, which closes it without an answer. */
  withdrawnAt?: number
}

/**
 * The session and the project of its questions, fixed at the first use of the questions in the
 * session. A session that /resume or /clear switched to takes the project of the scope before.
 */
export type SessionScope = {
  sessionId: string
  /** The digest of the project root that the store keys of the project begin with. */
  project: string
}

declare module 'claude-code' {
  interface PluginState {
    'workflow-skills': {
      /**
       * True while a turn of the main conversation runs. Answers are delivered differently
       * during a turn than while idle.
       */
      isTurnRunning: boolean
      /**
       * The scope of the session that last used the questions; null before any use and in a
       * session without a person at the prompt.
       */
      session: SessionScope | null
      /** The questions of the project, as this session last read or wrote them. */
      questions: readonly Question[]
      /** The ids of the questions whose answers this session is delivering right now. */
      deliveringAnswers: readonly string[]
    }
  }
}
