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
      };
    }) inputs.nixpkgs.legacyPackages;
  };
}
