---
name: hygiene
description: Decide what may go into everything that leaves the machine or goes to someone else, such as code, comments, documentation, commits and their messages, pull requests, issues and comments on them, packages and anything else published or sent.
---

# Hygiene

- Load `workflow-skills:writing-style` first. It applies to every comment, document, commit message
  and reply you write under this skill.
- Apply these rules to everything that leaves the machine: a commit and its message, a pushed
  branch, a pull request, an issue, a comment, a published document or package, and a message to
  someone else. Rules written down by a project add to these rules.

## Tracked files and their history

- Keep private conversation content, the user's words, setup facts, machine internals, local
  absolute paths, model names, facts about a session, personal data and secrets out of every
  tracked file and every commit message. This applies to code, comments, documentation, agent
  instructions such as `CLAUDE.md`, tests, scripts and assets alike.
- Write every tracked file and commit message so that nobody would raise an eyebrow if everyone
  read it. Keep it technical and focused. Write it for a reader who never saw the session.

## The user's words

- Keep the user's words verbatim only in untracked, ignored records, such as a private spec or the
  todo record.
- Read a general instruction to commit everything as excluding private records, private specs,
  prompts that contain private text, scratch files and the todo record.

## Setup facts

- Put a fact about the machine or the local setup into local memory or an ignored file, never into
  a repository.

## Commit messages

- Describe the technical change in a commit message. Keep process vocabulary, narration about the
  session, names of reviewers or stages, and actor words, such as owner, founder or admin, out of
  the message.
- Never put a model name into a commit.
- Never add a `Co-Authored-By` line to a commit.
- Describe a check in a `Test:` line in words where the literal command would reveal the setup.

## Public posts

- Open every post made under the account of a person, such as an issue, a comment or a pull
  request, with the note alert described in `workflow-skills:pr-comment-replies`.
- Write a post in your own voice.
- Give technical evidence in a post, such as commits, pull requests and issues by number.
- Keep local paths, host names, the names of accounts on the machine, session transcripts, process
  narration and the user's words out of a post.
- Never edit or delete a comment written by a person.
- To correct a comment posted by you, post a new comment.

## Secrets and personal data

- Never put a secret into a tracked file, a chat message, a command argument, a log, an error
  message or a screenshot.
- Keep a secret only in protected storage, such as a file readable only by the account that uses
  the secret, and read it from there at runtime.
- Pass a secret to and from a helper process only as JSON on its standard input and output, never
  as a command-line argument or an environment variable, which other processes can see.
- Strip a credential from any output that would show it, such as a remote URL that contains a
  token.
- Never keep a password given for one operation after that operation is done.
- Treat the configuration of a remote server as possibly secret.
- Inspect a received file for credentials and embedded host names before you use, copy or forward
  it.
- Never read a file that contains personal data or credentials into the conversation.
- Keep a tool that logs sensitive data outside every project folder.

## Before a repository goes public

- Before a repository goes public, audit its whole history as well as its current tree: every
  branch, ref and reachable blob, every commit message, and the assets, scripts, tests and
  comments.
- Rewrite the history of a repository or delete a ref only when the user says so.

## Identity

- Never pass the name or identity of the user to an agent or into an output that does not need it.
- Never put a personal name into a package root.
- Never put a git identity into a command, such as `-c user.name=…` or `--author`, unless the user
  asks for it.

## Third-party material

- Never put proprietary upstream code or proprietary prompt text into a public repository.
- Download a third-party asset meant to ship with the work, such as a font file, only when the user
  approves it. A font package that comes with the license of the font, such as a Fontsource package,
  is one way to avoid the download.
- Keep every license and notice that comes with third-party material.
- Keep the author attribution that comes with copied code.
- Never relicense adopted code silently.
- Never put a third-party mark under the license of the project.
- Keep downloaded research material in the project cache defined by `workflow-skills:local-cache`.
- Never ship downloaded research material.

## Rules in other skills

- Follow `workflow-skills:local-cache` for the project cache, the local storage and what goes
  into each.
- Follow `workflow-skills:todo-md` for the todo record.
- Follow `workflow-skills:implement` for the notes of the user's words and the draft that
  describes a change.
- Follow `workflow-skills:visual-verification` for the captures and real samples of a visual
  harness.
- Follow `workflow-skills:wall-of-shame` to record a violation of these rules.
