---
name: verifying-work
description: Check that change works, run and operate what it changed, and report what is known about it.
---

# Verifying work

- Prove change on real path, across whole chain. Green build is not proof.
- Check that cannot run the real thing: let it report itself as blocked. Never as passed on
  stand-in.
- Never build parallel simulation to check again what real environment already has.
- Operate interface from observed state: one action, check result, then next. Never a chain of
  inputs against assumed screen.
- Stop process by its process id. Never by name pattern or port on which it listens.
- State how every claim is known, without blurring the classes: measured (probe ran),
  compile-proven (builds but never ran), proven by reading source, decided, or open with the
  experiment that would resolve it.
- Base claim about state or cause on raw evidence inspected for that claim. Never on summary or
  verdict icon. Observation outweighs conclusion drawn from reading code.
- Record experiment that found nothing too.

## Rules in other skills

- Follow `workflow-skills:visual-verification` to prove change to user interface with screenshots.
- Follow `workflow-skills:local-cache` for where scratch files go.
