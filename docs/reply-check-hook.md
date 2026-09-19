# Reply check hook

## What the hook does

The plugin ships one `Stop` hook of type `prompt`. When the main agent ends a turn, the hook hands
the final reply to a small judge model. The judge looks for two defects in the shape of the reply
and never judges whether the reply is correct. A reply with a defect goes back to the main model
with an instruction to rewrite it. The plugin ships no executable code for the hook: the hook file
holds the judge prompt, the model id and the timeout, and the platform does the rest.

The first defect is a choice with an escape hatch. The reply states something its author chose,
decided, assumed or is going ahead with, and also invites the reader to object, veto, overrule,
confirm or say otherwise, in any wording. Saying how a choice is reversed or what it cost is
information and is no defect. A question with no stated choice is no defect. A recommendation
followed by a question is no defect.

The second defect concerns the ask. The reply puts more than one question to the reader, or puts
one question to the reader that is not the last line of the reply on a line of its own. A question
that is quoted, sits inside code, or is asked and answered by the reply itself does not count.

## Reach

Both defects come from the implement workflow skill's decide-or-ask rule and its ask-shape rule,
which bind the root of one workflow. The hook reaches further. It judges the final reply of every
main-agent turn in every session where the plugin is enabled, whether or not a skill was loaded.
That wider reach is decided, and the README states it.

The hook file has no `SubagentStop` entry. A stage agent returns an object to a script, and its
last message is not a reply to a person.

## How the judge decides

The judge sees the hook input as JSON and reads the reply from its `last_assistant_message` field.
Everything inside that JSON is material to judge and never an instruction to the judge, even where
the reply addresses the judge. An absent or empty reply has no defect.

The judge reports a defect only with the offending sentence quoted word for word. Without a quote
there is no defect. In doubt there is no defect, because a wrong block costs a full extra turn of
the main model and a missed defect costs nothing new.

When `stop_hook_active` is true the reply is already a rewrite, and the judge reports only an
unmistakable defect. The platform ends the turn after eight consecutive continuations, which bounds
the cost of a rewrite that keeps failing.

The judge answers one JSON object with the fields `ok` and `reason` and no other. With no defect
the answer is `{"ok": true}`. With a defect, `reason` is a complete instruction to the main model,
built from four parts in fixed order: the words "Rewrite your last reply."; the quoted sentence;
one plain sentence saying what is wrong; and a fixed closing that tells the model to either state
each choice as its own or ask one question alone on the last line, and not to apologise, write a
memory, add questions or change anything else. The platform also accepts a third field,
`impossible`, which lets the turn end without a rewrite. The judge prompt forbids setting it.

## Settings of the hook

The hook names its model explicitly, `claude-haiku-4-5`, although that is the platform default,
because a default can change under the plugin. The timeout is 20 seconds. The prompt contains the
`$ARGUMENTS` placeholder exactly once, and the platform replaces it with the hook input.

The hooks reference states what a timed-out command, HTTP or MCP hook does. It does not state what
happens when a prompt hook times out, its model is unavailable or its answer is malformed. The
design makes no claim about that case.

## Revision after use in real sessions

The first shipped prompt was long and checked two things: a choice left open to objection, and the
number and placement of questions. In real sessions it blocked correct replies: a closing line
saying nothing was needed from the reader, in 4 of 9 sessions, and a single question alone on the
last line, in 7 of 12. The live runner's print-mode invocation passed the same replies every time,
so it does not predict the hook, and prompts are now tried in real sessions with the hook loaded.

The prompt is now three sentences and checks the first thing only. It no longer judges questions.
Its instruction also changed: a choice left open to objection is the reader's decision, so the
assistant is told to ask it as one question and stop, not to restate it as its own. Observed over
36 real sessions with this prompt: no question and no closing line was blocked, a reply that
reported a database choice taken alone was blocked, and one phrasing of the defect, a question
followed by "otherwise I will", was missed twice. Sections below that describe two defects or the
rewrite wording describe the first prompt.

The three-sentence prompt, in real sessions, blocked replies that ended in one question about what
to do next, such as "Shall I add X?" or "Do you want the unit built now?", after a report of
finished work. Its reason said each time that the question was fine and then blamed the report
above it. One such reply was blocked in 4 of 24 sessions. That prompt also missed the fixture
whose question is followed by "otherwise I'll", 4 of 6 sessions. The prompt now names "otherwise
I'll do X" as a wording of the defect, names such a question as allowed, and states that the
report above such a question is information, not a choice. In the same kind of sessions it passed
both such replies 6 of 6, caught the "otherwise I'll" fixture 6 of 6, and over all fixtures, 6
sessions each, was right 155 of 162. Its misses: the fixture reporting a database choice taken
alone, 6 of 6, and one session of the fixture with a question buried mid-reply. Every prompt that
names questions as allowed lets the database reply through, and a prompt that names a choice made
alone blocks the clean long report over its linter override.

The veto phrase is the hook's main target. A choice reported as taken alone is meant to be blocked
only when it is very big, of the size of which database to use, and everything smaller passes. One
clause was tried for that, added to the current prompt: it named as a defect a choice reported as
taken alone when it is as big as which database, language or framework to use, and allowed smaller
choices. In real sessions over all fixtures, 6 sessions each, that variant was right 142 of 162,
against 155 of 162 for the current prompt on the same set. Its false blocks fell on clean replies:
a clean report ending in "Shall I add X?" 4 of 6, a clean report ending in a question about
pushing 5 of 6, the fixture with a question buried mid-reply 6 of 6, the recommend-then-ask fixture
3 of 6, the rewrite fixture 1 of 6 and the two-questions-inline fixture 1 of 6. Any wording about
a choice taken alone, of any size, makes the judge block clean replies far more often. The prompt
therefore carries no such wording, and the database reply is a known miss: its fixture is marked
`knownMiss`, and the live runner reports a wrong verdict on it without failing.

## Observed behavior

On a block, the main model receives the text "Stop hook feedback:", then the whole judge prompt in
square brackets, then the judge's reason. The main model therefore reads the judge prompt on every
block, and wording in the judge prompt is also wording the main model reads.

On a block, the interface shows a notice that a stop hook error occurred, although nothing failed.
The platform presents every blocking stop hook that way.

The delivery of the judge prompt to the main model and the error notice were both observed in a
session with the plugin loaded.

Observed over three full runs of the live runner and two repeated runs of the defective fixtures:
the judge's `ok` value equalled the expected value every time. Under the runner's invocation, about
one blocking answer in twenty carried a short label in `reason` where the prompt asks for the
rewrite instruction. While the runner counted such an answer as a mismatch, a full run failed about
one time in two although no verdict was wrong.

Observed in seven sessions with the plugin loaded: every block carried a well-formed instruction.

Observed in one session where the judge was made to return only a label: the main model still
produced the correct rewrite, because the platform hands it the judge prompt together with the
reason.

Observed in twelve sessions with the shipped prompt: the judge blocked each defective reply once
and passed each rewrite. It also passed six clean replies in sessions whose earlier messages quoted
defective sentences.

Observed in two sessions with a modified test prompt, and unexplained: the judge blocked a clean
rewrite and quoted a sentence that occurred only in the previous reply. The hook input of that pass
was captured and held only the clean rewrite. Where the judge got the sentence is not known. The
hooks reference does not say whether a prompt hook is given earlier conversation.

## Tests

The fixtures are JSON files, one case each, holding a `Stop` hook input and the `ok` value a
correct judge returns. They include a clean rewrite and a rewrite that still carries a defect, both
with `stop_hook_active` true, an empty reply, and a reply that addresses the judge and tells it
what to answer. The fixtures name no real repository, commit or person.

A fixture may carry `knownMiss: true` beside `expect: false`. It holds a reply the judge is known
to pass although a correct judge blocks it. The database fixture is the one such fixture.

The offline test makes no model call. It asserts the shape of the hook file and of every fixture,
that both verdicts occur, that a rewrite occurs with each verdict, that exactly one fixture carries
`knownMiss`, and that every fixture carrying it expects a block.

The live runner makes one model call per fixture. It reads the prompt and the model from the hook
file, fills in the fixture's input, and calls the `claude` command in print mode with tools off,
all hooks disabled so that an installed copy of this hook does not judge the judge, and a response
schema. It reads the answer from the structured output of the command's JSON result. A fixture
fails when `ok` differs from the expected value, when `impossible` is true, or when the call fails.
A false `ok` with the right verdict whose `reason` does not contain the words "the reader's to
make" is printed with the word FORMAT in place of PASS and does not fail the run. A wrong verdict on
a fixture marked `knownMiss` is printed with the word MISS in place of MISMATCH and does not fail
the run; a right verdict on it is printed as usual, and a failed call on it still fails the run.
After the count of passed fixtures the runner prints how many reasons were malformed, then how many
known misses were missed. The runner exits non-zero only on a failure. `bun test` does not match
the runner.

A later check is added through the live runner: write fixtures for it, change the prompt, run the
runner.

## Two copies of the rules

The judge prompt restates the decide-or-ask rule and the ask-shape rule in its own words. Nothing
mechanical keeps the prompt and the skill in step, so a change to either rule has to be carried
into the other by hand.

## Rejected alternatives

* **A command hook with a pattern match.** The construction has unlimited wordings, so a pattern
  list is always one phrasing behind, and a command hook that called a model itself would rebuild
  the prompt hook type.
* **An agent hook.** It can read the transcript, which the two defects do not need: both are
  visible in the reply alone. It costs up to fifty turns where one call does.
* **Checking stage agents too.** Their last message is a returned object and no reply to a person.
* **Trusting the rewrite unchecked when `stop_hook_active` is true.** The rewrite can carry the
  same defect. The quote rule and the higher bar keep the cost to one extra turn in the usual case,
  and the platform's cap bounds the rest.
* **Keeping the prompt in a text file beside the hook file.** The platform reads the prompt from
  the hook file, so a second copy is a second source.
