import { describeFailedStoreCall } from '../pluginStore'
import type { FailedStoreCall } from '../pluginStore'

export function describeStartNotRecorded(failed: FailedStoreCall): string {
  return (
    'The folder and the start time of this session could not be recorded, so later sessions ' +
    `cannot tell that it belongs to this project. ${describeFailedStoreCall(failed)}`
  )
}

export function describeFirstPromptNotRecorded(failed: FailedStoreCall): string {
  return (
    'The first prompt of this session could not be recorded, so later sessions cannot name ' +
    `this session by it. ${describeFailedStoreCall(failed)}`
  )
}
