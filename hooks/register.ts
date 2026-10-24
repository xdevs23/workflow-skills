import type { Register } from 'claude-code'

import { register as ruleChecker } from './rule-checker.ts'
import { register as todoReminder } from './todo-reminder.ts'

// The engine loads one hooks module for each plugin, which registers the hooks of every part.
export const register: Register = async (on, options) => {
  await ruleChecker(on, options)
  await todoReminder(on, options)
}
