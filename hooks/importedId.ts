/**
 * The ids given by an import into the session `intoSessionId` to the goals or reminders with the
 * ids `sourceIds`, by source id. An id is the hash of the session and the source id, so a repeated
 * import of one goal or reminder into one session gives it the same id, and finds what it stored
 * before, while an import into another session gives it another id. An id is unique across every
 * session therefore, as every other id of a goal or a reminder is.
 */
export async function importedIdsOf(
  intoSessionId: string,
  sourceIds: readonly string[],
): Promise<ReadonlyMap<string, string>> {
  const encoder = new TextEncoder()
  const ids = await Promise.all(
    sourceIds.map(async sourceId => {
      const digest = await crypto.subtle.digest(
        'SHA-256',
        encoder.encode(`${intoSessionId}:${sourceId}`),
      )

      return [sourceId, hexOf(new Uint8Array(digest).slice(0, ID_BYTES))] as const
    }),
  )

  return new Map(ids)
}

// The 16 bytes of a random UUID, as many as the ids made by crypto.randomUUID.
const ID_BYTES = 16

function hexOf(bytes: Uint8Array): string {
  return [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('')
}
