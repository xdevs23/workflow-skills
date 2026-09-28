# The pull request watcher

The plugin ships `watch-prs`, a Python tool that polls one or more pull requests through the GitHub
CLI and prints one JSON line for every new comment, review, review thread comment and failed check
on the head commit, and one line when a pull request closes or merges. The babysit-pr skill has the
agent run it once a pull request exists and act on each line it prints. The tool is a cleaned-up
version of a watcher first written inside one project, and it prints the same events with the same
fields.

The tool differs from that earlier watcher in these ways:

- The pull requests, the state file and the interval between polls come from the command line.
- Every read of GitHub goes through `gh api --paginate --slurp`, including the pull request itself
  and the lookup of a branch, which the earlier watcher read with a plain `gh api` call and
  `gh pr list`.
- A pull request named by branch is looked up among the open pull requests only, and a branch that
  matches none or more than one of them ends the tool with an error. The earlier watcher took the
  first pull request in any state.
- The tool checks once at start that `gh` is installed and logged in, and exits with an error when
  it is not.
- The tool creates the state file's directory when it is missing, and replaces the state file in
  one step.

## Running the tool

The tool is a Python program in the plugin's tools directory and runs with `python3`. It takes the
state file with `--state`, which is required, the seconds between polls with `--interval`, and one
or more pull requests as its remaining arguments. Each pull request is named as `owner/repo#number`,
or as `owner/repo@branch` for the open pull request whose head is that branch. The interval is 60
seconds unless `--interval` gives another finite number of seconds, zero included, and the tool
refuses a negative or infinite one. A name that matches neither form ends the tool with a usage
error before it calls `gh`.

The tool reads GitHub only through `gh api --paginate --slurp` and reads every answer with Python's
`json` module. A single object, such as the pull request itself, comes back from `--slurp` as a list
of one page. The tool needs Python 3 and a logged-in `gh`, and nothing else.

## Events

Every line the tool prints is one JSON object with a `kind`. At start it prints `watching` with
`prs`, the list of pull requests it resolved, each as `owner/repo#number`. Each poll of a pull
request then reads, in this order, its issue comments, its reviews, its review thread comments and
the check runs of its head commit, and prints every event whose id it has not printed before. Each
of these lines carries `pr` and `head`, the head commit's SHA at that poll:

- `comment`, an issue comment, with `author`, `url` and `body`;
- `review`, with `state`, `author`, `url`, `body` and `commit`, for every review other than a
  pending one, since a pending review is not submitted yet;
- `review-comment`, with `author`, `url`, `path`, `line`, `in_reply_to`, `body` and `commit`;
- `check-failed`, with `name`, `conclusion`, `url` and `commit`, for a completed check run on the
  head commit whose conclusion is `failure`, `timed_out`, `cancelled`, `action_required` or
  `startup_failure`.

A review comment's `line` is null when GitHub gives none, which it does for an outdated comment, and
its `in_reply_to` is null for the first comment of a thread. Check runs are read only for the head
commit, so a failed check on an older commit is never printed.

When a pull request is closed, the tool prints `merged` or `closed` with `pr` after that poll's
events and stops polling it. When a poll fails because a `gh` call exits with an error, the tool
prints `poll-error` with `pr` and the call's `stderr`, and polls that pull request again next time.
After the last pull request closes, the tool prints `done` and exits with status zero. Between two
polls of the remaining pull requests it sleeps for the interval.

## Pull requests named by branch

A pull request named by branch is the open pull request whose head branch has that name. The tool
lists the repository's open pull requests and collects every one whose head ref matches. A head ref
is only the branch name, so pull requests from different forks can share it. When exactly one
matches, the tool watches it. When none matches, the tool exits with an error that names the
repository and the branch. When more than one matches, it exits with an error that lists them and
asks for the one to watch by its number. Both errors come before the tool prints `watching` or polls
anything. A failing listing ends the tool the same way, with `gh`'s message. A pull request named by
number is watched as given.

## The login check

At start, before it reads the state file or looks at any pull request, the tool runs `gh auth
status`. When `gh` is not installed or not logged in, it exits with an error that says which. A
missing login would otherwise fail every poll, and the tool would print `poll-error` every interval
without end. A poll that fails after this check prints `poll-error`, and polling goes on, since such
a failure is usually temporary, such as a server error.

## State and restarts

The state file holds the sorted list of every event id already printed, each as
`owner/repo#number:` followed by a short prefix for the event's source (`ic`, `rv`, `rc` or `ck`)
and GitHub's id. The tool reads the file at start when it exists and creates the file's directory
when that is missing. It writes the file after every poll of a pull request, failed polls included,
by writing a second file next to it and replacing the state file with it in one step. A tool
stopped in the middle of that write leaves the previous state whole, so a restart never reads a
truncated file.

A restarted watch prints only what is new. The first poll of a pull request with no state prints
every event already on it, and the agent handles those first. The `merged` and `closed` lines are
not stored, so a restart on a closed pull request prints that line again and then `done`. An event
printed just before the tool stops, before the state was written, may print again after a restart.
The agent recognizes one it already answered by its reply on the pull request, since fetching the
comments also returns the replies to them.

## The babysit-pr skill

The skill's Start and watch section names the tool, says where the plugin keeps it and how to run
it. The agent keeps the state file in the project cache that `workflow-skills:local-cache` defines.
It runs the tool through the Monitor tool where the harness has it, since every printed line is one
event, and otherwise in a shell where `gh` is logged in, reading the lines the tool prints.

The agent does not act on its own replies. Every reply opens with the note alert that the
pr-comment-replies skill requires, and the agent recognizes its own replies by it, so a reply never
comes back to it as new work.

When a watch ends while the pull request is still open, the agent starts it again. When the tool
exits with an error, such as a missing login or a branch with no open pull request or with more than
one, the agent starts it again only once the cause the message names is fixed, so an error exit
does not turn into a restart loop. When the pull request is closed or merged, the agent stops.

The README's requirement list names the tool, its arguments, the events it prints and its need for
Python 3 and a logged-in `gh`.

## Tests

The watcher's tests run the tool with `python3` and an interval of zero against a stand-in `gh`
placed first on `PATH`. The stand-in answers `gh auth status` and each `gh api --paginate --slurp`
path from fixture JSON, with a list of answers per path taken one per call, the last one repeated,
and an answer either printed output or a failure with its stderr text. It logs every call, so a
test can check which paths the tool read.

The tests cover every event kind with its fields, a null `line` and `in_reply_to`, a pending review
and a failed check on an older commit left out, a restart with the same state printing no event
again while a new comment still prints, a branch name finding its open pull request, a branch with
none ending in an error, a branch shared by open pull requests from two forks ending in an error, a
closed and a merged pull request ending the watch with `done` and status zero, a failing `gh` call
printing `poll-error` before polling goes on, and a missing login or a missing `gh` ending the tool
with an error.

## Decisions

The pull requests and the state file come from the command line. The earlier watcher carried its
pull requests in its own source and kept its state file next to itself, which a tool shipped in a
plugin cannot do: it cannot carry one project's pull requests, and the plugin's directory is no
place for a project's state.

Every read of GitHub goes through `gh api --paginate --slurp` and Python's `json` module. The
GitHub CLI's output is JSON, and a library reads it. No part of the tool parses an established
format by hand. The branch lookup lists the open pull requests through the same call and matches
the head ref in Python.

A branch shared by more than one matching pull request ends the tool with an error. Taking one of
them would watch, and have the agent answer on, a pull request other than the one meant, and the
tool picks no fork on its own.

The login check runs once at start and ends the tool on failure, while a later failed poll keeps
polling. A missing login would otherwise print `poll-error` every interval without end, and no part
of the plugin leaves a session a way to loop.

The state file is replaced in one step. A watcher run through the Monitor tool is stopped by a
signal at any moment, and a truncated state file would end every later start with a JSON error.

OPEN: whether a branch name stands only for an open pull request, as the tool does now, or for a
pull request in any state, as the earlier watcher did, is not decided.
