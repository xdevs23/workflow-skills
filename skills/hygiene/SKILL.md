---
name: hygiene
description: Decide what may go into anything that leaves machine or goes to someone else
---

# Hygiene

- Apply these rules to everything that leaves the machine: commit and its message, pushed branch,
  pull request, issue, comment, published document or package, message to someone else. Rules
  written down by a project add to these rules.

## Tracked files and their history

- Keep out of every tracked file and every commit message: private conversation content, user's
  words, setup facts, machine internals, local absolute paths, model names, facts about a session,
  personal data, secrets. Applies to code, comments, documentation, agent instructions like
  `CLAUDE.md`, tests, scripts and assets alike.
- Write every tracked file and commit message so nobody would raise an eyebrow if everyone read it.
  Technical and focused. For reader who never saw the session.

## The user's words

- Keep user's words verbatim only in untracked, ignored records, e.g. private spec or todo record.
- General instruction to commit everything: read it as excluding private records, private specs,
  prompts that contain private text, scratch files and todo record.

## Setup facts

- Put fact about machine or local setup into local memory or ignored file. Never into a repository.

## Commit messages

- Describe technical change in commit message. Keep out of it: process vocabulary, narration about
  the session, names of reviewers or stages, actor words, e.g. owner, founder or admin.
- Never put model name into a commit.
- Never add `Co-Authored-By` line to a commit.
- Describe check in `Test:` line in words where literal command would reveal the setup.

## Public posts

- Open every post made under account of a person, e.g. issue, comment or pull request, with note
  alert described in `workflow-skills:pr-comment-replies`.
- Write post in your own voice.
- Give technical evidence in post, e.g. commits, pull requests and issues by number.
- Keep out of post: local paths, host names, names of accounts on the machine, session transcripts,
  process narration, user's words.
- Never edit or delete comment written by a person.
- To correct comment posted by you, post new comment.

## Secrets and personal data

- Never put secret into tracked file, chat message, command argument, log, error message or
  screenshot.
- Keep secret only in protected storage, e.g. file readable only by account that uses the secret.
  Read it from there at runtime.
- Pass secret to and from helper process only as JSON on its standard input and output. Never as
  command-line argument or environment variable, which is visible to other processes.
- Strip credential from any output that would show it, e.g. remote URL that contains a token.
- Never keep password given for one operation after that operation is done.
- Treat configuration of remote server as possibly secret.
- Inspect received file for credentials and embedded host names before using, copying or
  forwarding it.
- Never read file that contains personal data or credentials into the conversation.
- Keep tool that logs sensitive data outside every project folder.

## Before a repository goes public

- Before repository goes public, audit its whole history as well as its current tree: every
  branch, ref and reachable blob, every commit message, and the assets, scripts, tests and
  comments.
- Rewrite history of repository or delete a ref only when user says so.

## Identity

- Never pass name or identity of user to agent or into output that does not need it.
- Never put personal name into package root.
- Never put git identity into a command, e.g. `-c user.name=…` or `--author`, unless user asks for
  it.

## Third-party material

- Never put proprietary upstream code or proprietary prompt text into public repository.
- Download third-party asset meant to ship with the work, e.g. font file, only when user approves
  it. Font package that comes with license of the font, e.g. Fontsource package, is one way to
  avoid the download.
- Keep every license and notice that comes with third-party material.
- Keep author attribution that comes with copied code.
- Never relicense adopted code silently.
- Never put third-party mark under license of the project.
- Keep downloaded research material in project cache defined by `workflow-skills:local-cache`.
- Never ship downloaded research material.

## Rules in other skills

- Follow `workflow-skills:local-cache` for project cache, local storage and what goes into each.
- Follow `workflow-skills:todo-md` for todo record.
- Follow `workflow-skills:implement` for notes of user's words and draft that describes a change.
- Follow `workflow-skills:visual-verification` for captures and real samples of visual harness.
- Follow `workflow-skills:wall-of-shame` to record violation of these rules.
