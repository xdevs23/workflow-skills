---
name: changing-the-build
description: Add, update or choose dependency, or change how project builds, configures or releases its artifacts.
---

# Changing the build

- Build critical paths, e.g. boot, init, deployment, on robust declarative mechanisms. Never on
  fragile shell scripts.
- Keep builds reproducible. Lock every dependency to exact version, fetched with checksum. Run every
  build, release included, from clean checkout, with one command and without manual step.
- Build every configuration declared as supported by code, on every change.
- Remove configuration that is not built.
- Expose nothing for debugging in release build. Leave debug access out of it. Let build
  configuration select which kind of build is produced, never a constant edited in source.
- Put into generated artifact only output produced by generator, never diagnostics.
- Before adding dependency, choosing its version or writing against its API: look up current
  release and documentation online. Check that release for known compromise. Record check with
  date.
- Research and pick library yourself.
- Ask user before deciding where dependency is fetched from, e.g. registry or git repository. Also
  before vendoring a binary.
