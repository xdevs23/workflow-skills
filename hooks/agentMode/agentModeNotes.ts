import type { EngineInterface } from 'claude-code'

import { notesOfSetting } from '../settingNotes'
import type { SettingNotes } from '../settingNotes'
import { takeEveryAgentMode, takeUnreadAgentMode } from './agentModeState'
import { describeAgentModeNote, describeAgentModeNoteNotSent } from './agentModeTexts'

export function agentModeNotes($: EngineInterface): SettingNotes {
  return notesOfSetting({
    takeUnread: () => takeUnreadAgentMode($),
    takeEvery: () => takeEveryAgentMode($),
    describeNote: describeAgentModeNote,
    describeNotSent: describeAgentModeNoteNotSent,
  })
}
