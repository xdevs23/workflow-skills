import { deleteRecord, writeRecord } from '../pluginStore'
import type { StoreEngine } from '../pluginStore'
import { readSessionRecord } from '../sessionRecord'
import type { RecordRead } from '../sessionRecord'
import { IDLE_ROAST_FORMAT, IDLE_ROAST_ON_VALUE, idleRoastKeyOf } from './idleRoastRecord'

/** Whether the idle roast is on for the session `sessionId`, off while it has no record. */
export function readIdleRoastSwitch(
  $: StoreEngine,
  sessionId: string,
): Promise<RecordRead<boolean>> {
  return readSessionRecord($, idleRoastKeyOf(sessionId), IDLE_ROAST_FORMAT)
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
