import { isRecord, readStrings } from '../pluginStore'
import { UnreadablePost, unreadableField } from '../unreadablePost'
import type { ImportAction } from './importPaneMessages'

/** Reads the action posted by the surface module of an import pane, which arrives unchecked. */
export function readImportAction(action: unknown): ImportAction | UnreadablePost {
  if (!isRecord(action)) {
    return new UnreadablePost('an action is not an object')
  }
  const { fromSessionId } = action
  const pickedIds = readStrings(action.pickedIds)
  if (typeof fromSessionId !== 'string') {
    return unreadableField('fromSessionId')
  }

  return pickedIds === undefined ? unreadableField('pickedIds') : { fromSessionId, pickedIds }
}
