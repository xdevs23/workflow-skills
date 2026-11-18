/** Why a text did not give the model asked of it. */
export enum JsonTextNotRead {
  NotJson = 'not json',
  OtherShape = 'other shape',
}

/** The model read from a JSON text, or why the text did not give one. */
export type JsonTextRead<Model> =
  | { isRead: true; model: Model }
  | { isRead: false; reason: JsonTextNotRead }

/**
 * The model that `readModel` reads from the value parsed out of the JSON in `text`. `readModel`
 * returns undefined for a value of another shape.
 */
export function readJsonText<Model>(
  text: string,
  readModel: (value: unknown) => Model | undefined,
): JsonTextRead<Model> {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch (error) {
    if (error instanceof SyntaxError) {
      return { isRead: false, reason: JsonTextNotRead.NotJson }
    }
    throw error
  }
  const model = readModel(value)

  return model === undefined
    ? { isRead: false, reason: JsonTextNotRead.OtherShape }
    : { isRead: true, model }
}
