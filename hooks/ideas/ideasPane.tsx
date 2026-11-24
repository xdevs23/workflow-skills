import type { MatchedHook } from 'claude-code'

import { describeUnreadableRecord } from '../pluginStore'
import { askToDeleteIdea, deleteIdeaOnScreen } from './ideaActions'
import { compareLinks } from './ideaLink'
import { keepButtonKeyOf } from './ideaNames'
import type { IDEAS_PANE_SITE } from './ideaNames'
import {
  DELETE_IDEA_LABEL,
  DELETE_IDEA_QUESTION,
  IDEAS_LOADING,
  KEEP_LABEL,
  NO_IDEAS,
  YES_DELETE_LABEL,
} from './ideaPaneTexts'
import { IdeasOutcome, readIdeasInState, setIdeaAwaitingDelete } from './ideaState'
import { labelIdea } from './ideaTexts'

/**
 * Draws the ideas recorded in the project as the session last loaded them, by entry, goal and
 * project idea, oldest first, each with a button that asks to confirm its delete. A confirmed
 * delete removes the idea from the store.
 */
export const drawIdeasPane: MatchedHook<'ui.render', typeof IDEAS_PANE_SITE> = async ($, e) => {
  const { Box, Button, Text } = $.ui.resolve(e)
  const shown = await readIdeasInState($)
  if (shown === null) {
    return <Text dimColor>{IDEAS_LOADING}</Text>
  }
  if (shown.outcome === IdeasOutcome.Failed) {
    return <Text color="warning">{shown.failure}</Text>
  }
  const ideas = shown.ideas.toSorted(
    (one, other) => compareLinks(one.link, other.link) || one.recordedAt - other.recordedAt,
  )

  return (
    <Box flexDirection="column">
      {ideas.length === 0 ? <Text dimColor>{NO_IDEAS}</Text> : undefined}
      {ideas.map(idea => (
        <Box key={idea.id} flexDirection="column" marginBottom={1}>
          <Text bold>{labelIdea(idea)}</Text>
          <Text>{idea.words}</Text>
          {shown.awaitingDelete === idea.id ? (
            <Box columnGap={1} flexWrap="wrap">
              <Text color="warning">{DELETE_IDEA_QUESTION}</Text>
              <Button
                key={`confirm-delete-${idea.id}`}
                label={YES_DELETE_LABEL}
                variant="primary"
                onPress={() => deleteIdeaOnScreen($, idea.id)}
              />
              <Button
                key={keepButtonKeyOf(idea.id)}
                label={KEEP_LABEL}
                autoFocus
                onPress={() => setIdeaAwaitingDelete($, null)}
              />
            </Box>
          ) : (
            <Button
              key={`delete-${idea.id}`}
              label={DELETE_IDEA_LABEL}
              onPress={() => askToDeleteIdea($, idea.id)}
            />
          )}
        </Box>
      ))}
      {shown.unreadableKeys.map(key => (
        <Text key={key} dimColor>
          {describeUnreadableRecord(key)}
        </Text>
      ))}
    </Box>
  )
}
