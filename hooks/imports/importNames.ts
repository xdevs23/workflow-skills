import { ImportKind } from './importPaneMessages'

/**
 * The names of an import of one kind, used by the surface module and by the hooks module: its
 * command with the description of the command, its pane, the region drawn by the surface module of
 * the pane, the title of the pane, and the noun of what it imports, for one and for several.
 */
type ImportNames = {
  command: string
  description: string
  pane: string
  paneModule: string
  title: string
  noun: { one: string; several: string }
}

export const IMPORT_NAMES: Record<ImportKind, ImportNames> = {
  [ImportKind.Goals]: {
    command: 'goals-import',
    description: 'Import open goals of an earlier session of this project as new goals',
    pane: 'goals-import',
    paneModule: 'goals-import-pane',
    title: 'Import goals',
    noun: { one: 'goal', several: 'goals' },
  },
  [ImportKind.Reminders]: {
    command: 'reminders-import',
    description: 'Import reminders of an earlier session of this project',
    pane: 'reminders-import',
    paneModule: 'reminders-import-pane',
    title: 'Import reminders',
    noun: { one: 'reminder', several: 'reminders' },
  },
}

/** The site of the import pane of `kind`, which its hooks match. */
export function importPaneSiteOf(kind: ImportKind) {
  return { component: 'Pane', requestId: IMPORT_NAMES[kind].pane } as const
}
