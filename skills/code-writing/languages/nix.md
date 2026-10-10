# Nix

- Generate configuration files with `pkgs.formats`.
- Build with flakes, and make a flake input use another input or another source with input
  overrides (`inputs.<name>.follows`, `--override-input`).
- Run with `--show-trace` when evaluation fails.
- Pass uncommitted changes to a build through a `path:` reference, never by adding them to git for
  Nix.
- Let modules announce traits as typed enum options, with the enum constants in one types file.
- Let consumers read the trait options with `or null` and derive defaults with `mkDefault`.
- Make the state of the traits printable.
