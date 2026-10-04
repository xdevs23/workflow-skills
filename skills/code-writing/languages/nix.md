# Nix

- Generate configuration files with `pkgs.formats`. Build with flakes, make a flake input use
  another input or another source with input overrides (`inputs.<name>.follows`,
  `--override-input`), and run with `--show-trace` when evaluation fails.
- Pass uncommitted changes to a build through a `path:` reference, never by adding them to git for
  Nix.
- Let modules announce traits as typed enum options, with the enum constants in one types file.
  Consumers read the trait options with `or null` and derive defaults with `mkDefault`, and the
  state of the traits can be printed.
