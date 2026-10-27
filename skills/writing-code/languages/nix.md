# Nix

- Generate configuration files with `pkgs.formats`.
- Build with flakes.
- Make flake input use another input or another source with input overrides
  (`inputs.<name>.follows`, `--override-input`).
- Run with `--show-trace` when evaluation fails.
- Pass uncommitted changes to build through `path:` reference. Never add them to git for Nix.
- Let modules declare traits as typed enum options, enum constants in one types file.
- Let consumers read trait options with `or null`, derive defaults with `mkDefault`.
- Make state of traits printable.
