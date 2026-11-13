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
          # The type check and the lint of the hooks module.
          check = app "check" [ pkgs.bun pkgs.nodejs ] ''
            if [ ! -d .claude-plugin/types ]; then
              echo "The declarations of the mod API are missing in .claude-plugin/types/." >&2
              echo "An interactive session started with --plugin-dir . writes them." >&2
              exit 1
            fi
            bun install --frozen-lockfile
            node_modules/.bin/tsc -p .
            node_modules/.bin/eslint --max-warnings 0 hooks types
          '' "Run the type check and the lint of the hooks module";
        });
    };
}
