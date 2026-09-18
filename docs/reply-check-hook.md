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

## Observed behavior

On a block, the main model receives the text "Stop hook feedback:", then the whole judge prompt in
square brackets, then the judge's reason. The main model therefore reads the judge prompt on every
block, and wording in the judge prompt is also wording the main model reads.

On a block, the interface shows a notice that a stop hook error occurred, although nothing failed.
The platform presents every blocking stop hook that way.

The delivery of the judge prompt to the main model and the error notice were both observed in a
session with the plugin loaded.

## Tests

The fixtures are JSON files, one case each, holding a `Stop` hook input and the `ok` value a
correct judge returns. They include a clean rewrite and a rewrite that still carries a defect, both
with `stop_hook_active` true, an empty reply, and a reply that addresses the judge and tells it
what to answer. The fixtures name no real repository, commit or person.

The offline test makes no model call. It asserts the shape of the hook file and of every fixture,
that both verdicts occur, and that a rewrite occurs with each verdict.

The live runner makes one model call per fixture. It reads the prompt and the model from the hook
file, fills in the fixture's input, and calls the `claude` command in print mode with tools off,
all hooks disabled so that an installed copy of this hook does not judge the judge, and a response
schema. It reads the answer from the structured output of the command's JSON result. A fixture
passes when `ok` equals the expected value, `impossible` is not true, and a false `ok` comes with a
`reason` that begins with "Rewrite your last reply.". The runner exits non-zero on any mismatch or
call failure. `bun test` does not match the runner.

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
