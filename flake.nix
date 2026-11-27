{
  description = "Tools of the workflow-skills plugin";
  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  outputs = { nixpkgs, ... }:
    let systems = [ "x86_64-linux" "aarch64-linux" "aarch64-darwin" ];
    in {
      apps = nixpkgs.lib.genAttrs systems (system:
        let
          pkgs = nixpkgs.legacyPackages.${system};
          resvg = "${pkgs.resvg}/bin/resvg";
          fonts = "${pkgs.mona-sans}/share/fonts/truetype";
          app = name: runtimeInputs: text: description: {
            type = "app";
            program = "${pkgs.writeShellApplication { inherit name runtimeInputs text; }}/bin/${name}";
            meta.description = description;
          };
        in {
          # pr-lines with git, resvg and the Mona Sans fonts it draws with. Flags given to the
          # app come after these, so a --resvg or --fonts of the caller wins.
          pr-lines = app "pr-lines" [ pkgs.git ] ''
            exec ${pkgs.python3}/bin/python3 ${./tools}/pr-lines.py --resvg ${resvg} --fonts ${fonts} "$@"
          '' "Draw the diff lines between two commits by kind of file";
          # The type check and the lint of the hooks module, and the lint of the skills and agents.
          check = app "check" [ pkgs.bun pkgs.nodejs pkgs.gnugrep ] ''
            if [ ! -d .claude-plugin/types ]; then
              echo "The declarations of the mod API are missing in .claude-plugin/types/." >&2
              echo "An interactive session started with --plugin-dir . writes them." >&2
              exit 1
            fi
            bun install --frozen-lockfile --silent
            logs=$(mktemp -d)
            trap 'rm -r "$logs"' EXIT
            # The type-aware lint keeps no cache: a cached file misses errors caused by other files.
            node_modules/.bin/tsc -p . --incremental \
              --tsBuildInfoFile node_modules/.cache/tsc/tsbuildinfo > "$logs/tsc" 2>&1 &
            tsc=$!
            node_modules/.bin/eslint --max-warnings 0 hooks types > "$logs/eslint" 2>&1 &
            eslint=$!
            failed=0
            # -z reads each file as one record, so a phrase broken across lines is found too.
            if grep -l -z -i -P "\buser['’]s\b|\bof\s+user\b(?!-)" skills/*/SKILL.md agents/*.md; then
              echo "The files above write \"user's\" or \"of user\". Write \"user words\"." >&2
              failed=1
            fi
            wait "$tsc" || failed=1
            cat "$logs/tsc"
            wait "$eslint" || failed=1
            cat "$logs/eslint"
            exit "$failed"
          '' "Run the type check and the lint of the hooks module, and the lint of skills and agents";
        });
    };
}
