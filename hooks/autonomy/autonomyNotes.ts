import type { EngineInterface } from 'claude-code'

import { notesOfSetting } from '../settingNotes'
import type { SettingNotes } from '../settingNotes'
import { takeEveryGrant, takeUnreadGrants } from './autonomyState'
import { describeAutonomyNote, describeAutonomyNoteNotSent } from './autonomyTexts'

export function autonomyNotes($: EngineInterface): SettingNotes {
  return notesOfSetting({
    takeUnread: () => takeUnreadGrants($),
    takeEvery: () => takeEveryGrant($),
    describeNote: describeAutonomyNote,
    describeNotSent: describeAutonomyNoteNotSent,
  })
}
