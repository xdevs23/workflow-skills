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
          # The tests in the current directory, with resvg and the fonts for the rendering test of
          # pr-lines. Arguments replace the default of every test in tests/.
          test = app "test" [ pkgs.bun pkgs.git pkgs.python3 ] ''
            if [ "$#" -eq 0 ]; then set -- tests/; fi
            export PR_LINES_RESVG=${resvg} PR_LINES_FONTS=${fonts}
            exec bun test --timeout 60000 "$@"
          '' "Run the tests of the plugin, the rendering test of pr-lines included";
        });
    };
}
