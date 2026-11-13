import { describe } from 'claude-code/testing'

import { ASKED_APPROVAL } from './askedApproval'
import { declareRefusalCases } from './refusalTestSupport'

describe('a message that ends on a question asking the user to approve work', () => {
  declareRefusalCases(ASKED_APPROVAL, {
    refused: [
      'Can you approve or correct the export limit draft at .cache/specs/export-limit.html?',
      'The layout is drawn. Could you review the draft at .cache/specs/plan.html?',
      'Would you approve the plan for the second module? **',
      'Can you please sign off on the new settings page?',
      'Can you sign-off on the new settings page?',
      'Can you just approve the draft?',
      'Would you like to review the menu draft?',
      'Do you want to approve the menu draft?',
      'Do you approve the draft of the settings page?',
      'Will you okay the menu draft？',
      'Could you green-light the rewrite?',
      '**Can you approve the draft?**',
      'The page is open.\n- Can you approve it?',
      'Does this look right?',
      'Does the layout look right?',
      'The page shows both states. Do these look good? ',
      'Can you approve the push of main to origin?',
      'Could you review the deletion of the old branches?',
    ],
    passed: [
      'Can you check which port the host uses?',
      'Which reviewer can approve the change?',
      'How can you review a change without the suite?',
      'Do you accept cards at the front desk?',
      'Can you accept the invite to the repository?',
      'You asked: "Can you approve the draft?"',
      'Can you approve the draft, I wondered. Which label fits better?',
      'Does this lookup return every row?',
    ],
  })
})

describe('a question asking for approval that is not the last sentence', () => {
  declareRefusalCases(ASKED_APPROVAL, {
    refused: [],
    passed: ['Can you approve the draft? Take your time.'],
  })
})
