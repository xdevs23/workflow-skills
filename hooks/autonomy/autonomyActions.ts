import type { EngineInterface } from 'claude-code'

import { showFailure } from '../failureToast'
import { loadGrantsIntoState } from './autonomyState'
import { describeGrantsFailure } from './autonomyTexts'

export async function loadGrantsShowingFailures($: EngineInterface): Promise<void> {
  for (const failure of (await loadGrantsIntoState($)).failures) {
    showFailure($, describeGrantsFailure(failure))
  }
}
