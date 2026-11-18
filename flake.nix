{
  description = "Slim NPM Env";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-unstable";
  };

  outputs = inputs: {
    devShells = builtins.mapAttrs (system: pkgs: {
      default = pkgs.mkShell {
        packages = with pkgs; [
          nodejs_24
        ];

        shellHook = ''
          # Automatically run 'npm install' if node_modules is missing
          if [ -f "package.json"] && [ ! -d "node_modules" ]; then
            echo "node_modules not found. Running npm install..."
            npm install
          fi
        '';
      };
    }) inputs.nixpkgs.legacyPackages;
  };
}
