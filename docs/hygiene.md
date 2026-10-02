# What may leave the machine

The skill `workflow-skills:hygiene` holds the rules for everything that leaves the machine or goes
to someone else: commits and their messages, pushed branches, pull requests, issues and comments,
published documents and packages. It covers tracked files and their history, the user's words, setup
facts, commit messages, public posts, secrets, the audit before a repository goes public, identity,
and third-party material. A project's own rules add to it.

The main script and the fix-run script tell every stage that writes, and every briefed reader, to
read `workflow-skills:hygiene` beside `workflow-skills:writing-style` before writing, and so do the
copywriting skill and the four writer templates. `workflow-skills:writing-style` points to the
hygiene skill for what may reach a tracked file, and `workflow-skills:report-plugin-issues` points
to it for what stays out of an issue. The unbriefed reviewers and the roaster do not read it: what
they write returns to the session that runs them and leaves the machine only through that session.

## Decisions and their reasons

Each rule lives in one place. The rules of the project cache, the todo record, the unit spec, the
captures of a visual harness, the note alert of a public post and the record of a violation stay in
the skills that hold them, and the hygiene skill names those skills.

The skill holds only rules that apply to every project. Rules of a single project, of a single
machine's setup and of formats that were replaced stay where they are.

A third-party asset that ships with the work, such as a font file, is downloaded only with the
user's approval. A font package that carries the font's license, such as a Fontsource package, is
one way to do without the download, and every license and notice stays with the material it belongs
to.

## Alternatives the user rejected

- Putting the decision about when to ask before publishing into the skill was rejected: the skill
  covers what is published, and when to ask stays with the user's own rules.
