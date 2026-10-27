---
name: verifying-work
description: Check that a change works, run and operate what it changed, and report what is known about it.
---

# Verifying work

- Prove a change on the real path and across the whole chain. A green build is not proof.
- Let a check that can't run the real thing report itself as blocked, never as passed on a
  stand-in.
- Never build a parallel simulation to check again what the real environment already has.
- Operate an interface from its observed state: one action, check the result, then the next, never
  a chain of inputs against an assumed screen.
- Stop a process by its process id, never by a name pattern or the port on which it listens.
- State how every claim is known, without blurring the classes: measured (a probe ran),
  compile-proven (it builds but never ran), proven by reading the source, decided, or open with the
  experiment that would resolve it.
- Base a claim about state or cause on raw evidence inspected for that claim, never on a summary or
  a verdict icon. An observation outweighs a conclusion drawn from reading the code.
- Record an experiment that found nothing too.

## Rules in other skills

- Follow `workflow-skills:visual-verification` to prove a change to a user interface with
  screenshots.
- Follow `workflow-skills:local-cache` for where scratch files go.
