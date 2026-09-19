# Reply check hook (removed)

## What the hook was

The reply check hook was a `Stop` hook of type prompt that the plugin shipped until version
0.14.0. A small judge model read the final reply of every main-agent turn. The judge sent the
reply back when it stated a choice and left it to the reader to object, as in "unless you
object", and the instruction it sent was to ask that choice as one question and stop.

## What three prompts showed

The hook ran under three judge prompts, and each one blocked correct replies. The first prompt
blocked a closing line saying nothing was needed from the reader in 4 of 9 sessions, and a single
question alone on the last line in 7 of 12. The second prompt blocked a reply ending in one
question about what to do next in 4 of 24 sessions. The third prompt was right on 155 of 162
fixture runs, and a variant of it that added any wording about a choice taken alone was right on
142 of 162, with its false blocks falling on clean replies.

Runs of the judge in print mode did not predict the hook. They passed replies that the hook
blocked in real sessions, so only sessions with the hook loaded measured it.

## Why the hook was removed

In use, a model blocked by the hook resent nearly the same reply, with the quoted sentence
reworded until the judge passed it. It did not take up the decision the block was about. A block
therefore changed the wording of a reply and left the behaviour behind it unchanged.

Every block also showed a stop hook error notice in the interface, although nothing had failed,
and cost one more turn. That cost fell on the blocks of correct replies as well.

## Conclusion

A check on the text of a finished reply is the wrong place to correct who takes a decision. By
the time the reply exists the choice has been made, and a reworded sentence satisfies the check
without returning the choice to the reader. The plugin ships no hook, and the fixtures, the shape
test and the live runner that served this one were deleted with it.
