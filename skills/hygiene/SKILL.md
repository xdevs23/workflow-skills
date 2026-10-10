---
name: hygiene
description: Applies to everything that leaves the machine or goes to someone else, such as code, comments, documentation, commits and their messages, pull requests, issues and comments on them, packages and anything else published or sent.
---

# Hygiene

**Load the `workflow-skills:writing-style` skill first.** It binds every comment, document, commit
message and reply this skill produces, and it is not optional when working with this plugin.

This skill holds the rules for what may leave the machine: a commit and its message, a pushed
branch, a pull request, an issue or a comment, a published document or package, and a message to
someone else. A project's own rules add to these.

## Tracked files and their history

- Keep out of every tracked file and every commit message: private conversation content, the
  user's words, setup facts and machine internals, local absolute paths, model names, facts about a
  session, personal data and secrets.
- Apply this to code, comments, documentation, agent instructions such as `CLAUDE.md`, tests,
  scripts and assets alike.
- Write so that nobody would raise an eyebrow if everyone read it: technical, focused, and clear to
  a reader who never saw the session.

## The user's words

- Keep the user's words verbatim only in untracked, ignored records, such as a private spec or the
  todo record.
- Read a general instruction to commit everything as excluding private records, private specs,
  prompts that hold private text, scratch files and the todo record.

## Setup facts

- Put a fact about the machine or the local setup into local memory or an ignored file. It stays
  out of every repository.

## Commit messages

- Describe the technical change, and keep process vocabulary, narration of the session, names of
  reviewers or stages, and actor words such as owner, founder and admin out of the message.
- Put no model name into a commit.
- Add no `Co-Authored-By` line to a commit.
- Describe a check in a `Test:` line in words where its literal command would reveal the setup.

## Public posts

- Open every post made under someone's account, such as an issue, a comment or a pull request, with
  the note alert that `workflow-skills:pr-comment-replies` describes.
- Write a post in your own voice.
- Give technical evidence in a post, such as commits, pull requests and issues by number.
- Keep local paths, host names, the names of accounts on the machine, session transcripts, process
  narration and the user's words out of a post.
- Never edit or delete a comment a person wrote.
- Correct a comment of your own with a new one.

## Secrets

- Never put a secret into a tracked file, a chat message, a command argument, a log, an error
  message or a screenshot.
- Keep a secret only in protected storage, such as a file readable by its own account alone, and
  read it from there at runtime.
- Strip a credential from any output that would show it, such as a remote URL that carries a token.

## Before a repository goes public

- Audit the whole history as well as the current tree: every branch, ref and reachable blob, every
  commit message, and the assets, scripts, tests and comments.
- Rewrite history or delete a ref only on the user's word.

## Identity

- Pass the user's name or identity to no agent and into no output that does not need it.
- Put no personal name into a package root.

## Third-party material

- Put no proprietary upstream code and no proprietary prompt text into a public repository.
- Download no third-party asset meant to ship with the work, such as a font file, unless the user
  approves it.
- Consider a font package that carries the font's license, such as a Fontsource package, as one way
  to do without a download.
- Keep every license and notice that comes with third-party material.
- Never relicense adopted code silently.
- Never put a third-party mark under the project's own license.
- Keep downloaded research material in the project cache that `workflow-skills:local-cache` defines.
- Ship no downloaded research material.

## Rules other skills hold

- Follow `workflow-skills:local-cache` for the project cache and what goes into it.
- Follow `workflow-skills:todo-md` for the todo record.
- Follow `workflow-skills:implement` for the notes of the user's words and the draft of a change.
- Follow `workflow-skills:visual-verification` for the captures and real samples of a visual
  harness.
- Follow `workflow-skills:wall-of-shame` to record a violation of these rules.
