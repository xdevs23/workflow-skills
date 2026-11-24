import { deleteRecord, readEntriesIn, writeRecord } from '../pluginStore'
import { returningStoreFailure } from '../storeFailures'
import type { StoreEngine } from '../pluginStore'
import type { FailedStoreCall } from '../storeFailures'
import { IDLE_ROAST_ON_VALUE, idleRoastKeyOf, isIdleRoastOnValue } from './idleRoastRecord'

/** What was read of the idle roast switch of a session. */
export enum SwitchOutcome {
  Read = 'read',
  /** The record is of another shape or of a higher version. */
  Unreadable = 'unreadable',
  /** The store failed to read the record. */
  NotRead = 'not read',
}

export type SwitchRead =
  | { outcome: SwitchOutcome.Read; isOn: boolean }
  | { outcome: SwitchOutcome.Unreadable; key: string }
  | { outcome: SwitchOutcome.NotRead; failed: FailedStoreCall }

/** A switch that could not be read, with the reason. */
export type UnreadSwitch = Exclude<SwitchRead, { outcome: SwitchOutcome.Read }>

/** The idle roast switch of the session `sessionId`, off while the session has no record. */
export function readIdleRoastSwitch($: StoreEngine, sessionId: string): Promise<SwitchRead> {
  const key = idleRoastKeyOf(sessionId)

  return returningStoreFailure(
    async (): Promise<SwitchRead> => {
      const [stored] = await readEntriesIn($, key, [key])
      if (stored === undefined) {
        return { outcome: SwitchOutcome.Read, isOn: false }
      }

      return isIdleRoastOnValue(stored.value)
        ? { outcome: SwitchOutcome.Read, isOn: true }
        : { outcome: SwitchOutcome.Unreadable, key }
    },
    (failed): SwitchRead => ({ outcome: SwitchOutcome.NotRead, failed }),
  )
}

/** Writes the record of the session `sessionId` when `isOn`, and deletes it otherwise. */
export function saveIdleRoastSwitch(
  $: StoreEngine,
  sessionId: string,
  isOn: boolean,
): Promise<void> {
  return isOn
    ? writeRecord($, { key: idleRoastKeyOf(sessionId), value: IDLE_ROAST_ON_VALUE })
    : deleteRecord($, idleRoastKeyOf(sessionId))
}
