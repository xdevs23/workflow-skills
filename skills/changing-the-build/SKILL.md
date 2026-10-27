---
name: changing-the-build
description: Add, update or choose a dependency, or change how the project builds, configures or releases its artifacts.
---

# Changing the build

- Build critical paths, such as boot, init and deployment, on robust, declarative mechanisms, never
  on fragile shell scripts.
- Keep builds reproducible. Lock every dependency to an exact version fetched with a checksum, and
  run every build, release included, from a clean checkout with one command and without a manual
  step.
- Build every configuration declared as supported by the code on every change.
- Remove a configuration that isn't built.
- Expose nothing for debugging in a release build. Leave debug access out of it, and let the build
  configuration select which kind of build is produced, never a constant edited in source.
- Put into a generated artifact only the output produced by the generator, never diagnostics.
- Before you add a dependency, choose its version or write against its API, look up its current
  release and documentation online, check that release for known compromise, and record the check
  with its date.
- Research and pick which library to use yourself.
- Ask the user before you decide where a dependency is fetched from, such as a registry or a git
  repository, and before you vendor a binary.
