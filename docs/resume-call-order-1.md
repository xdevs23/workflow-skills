# What a resumed run replays

The resume-interrupted-run skill holds the plugin's one account of which `agent()` calls a resumed
workflow run replays from its journal and which calls run live. The implement-review-verify skill
points to that account from its law on resuming interrupted runs and from its resume corollaries,
and describes the mechanism nowhere else. The account follows the workflow runtime, as read from
its source.

## The journal key

The journal key of a call comes from three parts: the prompt, the options `schema`, `model`,
`effort`, `isolation`, `agentType`, `disallowedTools` and `bashCommandClamp`, and the key of the
call the script made just before it. Because each key includes the key before it, a new key for one
call gives every later call a new key as well. An edit of the prompt, even a single space, or of
one of those seven options gives the call a new key. An edit of any other option, such as `label`,
`phase` or `stallMs`, leaves the key as it was.

## Where the replay ends

A resume replays journaled results in the order the script makes its calls, up to the first call
that has no journaled result and was not interrupted. The journal shows an interrupted call as
started, with no failure recorded for it. From the first such call on, every call runs live, also a
call whose key the journal holds with a result.

Three kinds of call end the replay:

- a call whose key the journal does not hold, such as an edited call, or a call that the arrival
  order of earlier results moved to another place in the order;
- a call that failed or returned no result, such as an attempt that the fail-fast law of
  implement-review-verify retries;
- a call that had not started when the run stopped.

An interrupted call whose prompt and options stay unchanged runs live without ending the replay, so
the finished calls made after it replay. A later resume of the same run replays the calls an earlier
resume ran live only when it makes them in the same order with the same keys and nothing before them
ends the replay. The order of calls that wait for results depends on when those results arrive, so
one resume does not settle it for the next.

## The resume note

A resume note appended to an interrupted agent's prompt changes that call's key, so every finished
call after it runs live again. The skill therefore has the reader list those finished calls before
editing, and add notes only when the interrupted work they save outweighs the finished work they
re-run.

The note tells the interrupted agent seven things. An earlier attempt of the same agent was
interrupted through no fault of its own, its transcript is at a given path, and it reads that
transcript first. Its prompt is the authority on its input where an input differs from what the
transcript shows. It verifies again only what the code or such a differing input changed, the
findings that rest on that input included. It carries every other finding forward verbatim, and it
spends the rest of its effort on what it had not yet covered. The fourth rule of the skill and the
example note state the same condition for verifying again, so an agent whose input changed while
the code did not rechecks the work that input affects.

## Decisions

The mechanism is recorded once, in the resume skill, so that a correction of the account reaches
every reader through one passage. The law on resuming in implement-review-verify keeps its own rule
that only an interrupted run is resumed.

The skill names the seven options of the key explicitly. A general statement that the options form
the key would make an edit of `label` or `phase` look as costly as an edit of the prompt.
