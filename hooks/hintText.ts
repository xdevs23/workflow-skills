/** A step written in the texts of several hints, which a note joining those texts contains once. */
export type SharedStep = { readonly text: string }

/** A sentence of a hint text, or a step shared with other hints. */
export type HintPart = string | SharedStep

/** The text of a hint or a refusal: its sentences, some of which are shared steps. */
export type HintText = readonly HintPart[]

function isSharedStep(part: HintPart): part is SharedStep {
  return typeof part !== 'string'
}

/** The text as one string, with every part of it. */
export function writeHintText(text: HintText): string {
  return text.map(part => (isSharedStep(part) ? part.text : part)).join(' ')
}

/**
 * The texts as strings, each without the shared steps that an earlier text already contains. A
 * text left without a part gives no string.
 */
export function writeHintTextsWithEachStepOnce(texts: readonly HintText[]): string[] {
  const written = new Set<SharedStep>()

  return texts.flatMap(text => {
    const parts = text.filter(part => !isSharedStep(part) || !written.has(part))
    parts.filter(isSharedStep).forEach(step => written.add(step))

    return parts.length === 0 ? [] : [writeHintText(parts)]
  })
}
