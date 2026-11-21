import type { Hook } from 'claude-code'

import { showFailuresOfPress } from '../failureToast'
import type { FooterButton } from '../promptFooter'
import { IDEAS_BUTTON_LABEL } from './ideaPaneTexts'
import { openIdeasPane } from './ideaScreens'

export const openIdeasFromButton: Hook<'ui.press'> = async ($, e) =>
  showFailuresOfPress($, e, await openIdeasPane($, { button: IDEAS_BUTTON.label }))

/** The Ideas button on the prompt footer. */
export const IDEAS_BUTTON: FooterButton = { key: 'open-ideas', label: IDEAS_BUTTON_LABEL }
