/** What the user wrote in reply to a question. */
export type Answer = {
  text: string
  answeredAt: number
  /** Whether the asking session has read the answer, from a tool result, a prompt or the list. */
  isDelivered: boolean
}

/**
 * A question the model put to the user, stored under the session that asked it until the user
 * answers it. Only that session shows it, stores its answer and delivers that answer.
 */
export type Question = {
  /** The part of the store key that names the question, unique across every session. */
  id: string
  /** The number the user and the model name the question by, unique in its session. */
  number: number
  text: string
  /** The answers the user can pick from; empty for a question answered in words alone. */
  choices: readonly string[]
  askedAt: number
  answer?: Answer
  /** When the asking session took the question back, which closes it without an answer. */
  withdrawnAt?: number
}

/** The questions of a session, as the session last read or wrote them. */
export type SessionQuestions = {
  sessionId: string
  questions: readonly Question[]
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
       * The questions of the session that last read or wrote them, with the id of that session,
       * since the state may outlive a switch to another session by /clear or /resume; null before
       * any session read them and in a session without a person at the prompt.
       */
      sessionQuestions: SessionQuestions | null
      /** The ids of the questions whose answers this session is delivering right now. */
      deliveringAnswers: readonly string[]
    }
  }
}
