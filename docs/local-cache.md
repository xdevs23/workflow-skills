# One definition of the project cache, the todo record skill, and the reading stages' scratch rule

The plugin used to state a project-local cache directory in several places as if it were its
own rule, while it came from one person's setup, and it told reading stages to write scratch
there although they are read-only. It also told the orchestrating session to record work in a
work record without saying what that is.

Now one skill defines the project cache and another defines the todo record. Every other text
refers to them by name, a person's own skill of the same name takes precedence, and reading
stages write nothing except command output that cannot be read directly.

This document is generated from a private spec by the spec tool and is never edited by hand.

## Requirements

**reviewer-scratch-conflict**: The conflict between where the plugin tells stages to put scratch files and what reading stages may write is resolved.

**issue-three-rule**: The reported rule for reading stages: no copies and no notes; only a command's output that
cannot be read directly may be written to the system temporary directory.

**cache-is-a-setup-detail**: The project cache directory the plugin names is a detail of one person's setup, not a rule of the plugin.

**one-definition**: The project cache is defined in one place, a skill named local-cache, which takes its content
from the rules the user wrote about that directory, states that the user's global
preferences take priority over it, and is referred to everywhere else by its name.

**todo-md-moves-in**: The todo-md skill moves into this repository and is referenced as workflow-skills:todo-md.
For both todo-md and local-cache, a skill of that name without the plugin prefix, the
user's own, takes precedence; the prefixed one is used only when it is the only one
available.

**todo-md-reference**: The todo-md skill is referenced by its prefixed name and can be overridden by the user's own.

**record-has-meaning**: The plugin's instructions to record work refer to the todo-md skill, so recording work has a defined meaning.

**build-now**: The unit is built now.

**rule-temporary-files**: The user's rules put temporary files, logs, research and plans in a gitignored cache directory in the project.

**rule-worktrees**: The user's rules put workflow worktrees under the cache directory.

**rule-agent-scratch**: The user's rules put a stage's scratch files in a per-agent directory under the cache, or in the worktree's cache.

**rule-reviewers-read-only**: The user's rules make reviewers read-only, with the system temporary directory as the only place they may write.

**shared-scratch-line**: At version 0.17.0 every shipped script told every stage, reading stages included, to put scratch files in the project cache and never in a global temporary directory.

**local-cache-skill**: A new skill, `skills/local-cache/SKILL.md`, named local-cache, is the one definition of the
project cache: the ignored, untracked `.cache/` directory at the project root, which the
project's ignore rules must cover. It states what goes there: temporary files, logs,
research and plans; private specs under `.cache/specs/` and private directive records under
`.cache/directives/`; workflow worktrees under `.cache/worktrees/`; and a writing stage's
scratch files under `.cache/<agent-scope>/`, or, inside a worktree, under that worktree's
`.cache/`. It states that reading stages write nothing there. It states that nothing in it
is ever committed. Its first paragraph states the precedence rule of `skill-precedence`.
Its description lets it load when a session decides where to put a file that is not meant
for the repository.

**reading-stage-scratch**: A reading stage writes nothing: no copies of files and no notes. The one exception is the
output of a command that cannot be read directly, which it may write to the system
temporary directory. A writing stage puts scratch files where local-cache says. The
local-cache skill states both rules, and the shared prompts of the shipped scripts carry
them by role: the block that only writing stages receive carries the writing rule, the
blocks that reading stages receive carry the reading rule, and no block that both receive
names a scratch location. The simpler alternative this rules out is one scratch sentence for
every stage, which is the conflict being fixed.

**todo-md-skill**: The user's todo-md skill is copied into `skills/todo-md/SKILL.md` unchanged in its rules,
with only the edits needed for a published plugin: its first paragraph states the
precedence rule of `skill-precedence`, and any private detail is removed. The plugin's
instructions to record remaining items, cleanup and recorded findings name
workflow-skills:todo-md instead of describing a file.

**skill-precedence**: For local-cache and todo-md alike: when a skill of that name without the plugin prefix is
available in the session, that skill is used and the plugin's is not; when only the
prefixed skill is available, the plugin's is used. Every text of the plugin that refers to
either skill names it with the prefix and applies this rule; the rule itself is written out
in the two skills and once in the README.

**references-by-name**: Every text of the plugin that names the cache directory or a path in it refers to
workflow-skills:local-cache instead: the spec and record paths in implement-review-verify
and immaculate-spec-writing, the worktree location, and the scratch sentences of the three
shipped scripts. A path a command needs, such as the spec path in an example command,
stays, marked as the location local-cache defines. Stage prompts cannot load skills, so
the shipped scripts point the stages at the skill's file under the plugin root, read with
the Read tool, the same way they point at the writing-style file; the roaster, which has no
Read tool, receives only the reading rule in its prompt text. The placeholders in the
scripts' marked blocks derive their paths from that definition.

## Boundaries

**files-in-scope**: The unit adds the local-cache and todo-md skills, and edits the three shipped scripts, the
skills and agent templates that name the cache or the work record, the README, the tests
that assert the changed prompt lines, the generated design document, and the plugin
version, which becomes 0.18.0. The words seat and lane stay where they name existing
review roles. Nothing else.

## Rejected alternatives

**rejected-scratch-for-reviewers**: A scratch location in the project cache for reading stages.
Reason: Reading stages are read-only; the only write left to them is command output they cannot read otherwise.

## Acceptance criteria

1. **criterion-local-cache**: The local-cache skill exists with the content of `local-cache-skill` and the precedence rule,
   and no skill, template or script of the plugin other than it names the cache directory
   except in a path a command needs, marked as such.
2. **criterion-scratch**: In all three scripts no prompt block that reading stages receive names a scratch location
   other than the temporary-directory exception, the writing block names local-cache, and
   routing tests assert both for every stage.
3. **criterion-todo-md**: The todo-md skill exists in the plugin with the precedence rule and no private detail, and
   every instruction to record work names workflow-skills:todo-md.
4. **criterion-done**: `bun test tests/` passes, the generated design document equals the tool's render of this
   spec, and the version is 0.18.0.
