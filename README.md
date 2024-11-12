# Molstar Easy

![CI](https://github.com/nitro-bio/molstar-easy/actions/workflows/main.yml/badge.svg)

[Documentation](https://docs.nitro.bio)

`molstar-easy` makes it simple to get started using molstar in react projects. It provides a bare-bones api that allows styling of the viewer and the loaded protein structures, as well as annotating specific regions of the protein via highlighting.

## Quickstart

```sh
npm i @nitro-bio/molstar-easy
```

```tsx
import { MoleculeViewer } from "@nitro-bio/molstar-easy";
export const Demo = () => {
  const highlight = {
    label: { text: "Red Annotation", hexColor: "#881337", scale: 1 },
    start: 14,
    end: 30,
  };
  const pdbUrl = "https://files.rcsb.org/download/1CRN.pdb";
  const [pdbStr, setPdbStr] = useState<string | null>(null);
  useEffect(
    function fetchPDB() {
      fetch(pdbUrl)
        .then((res) => res.text())
        .then((pdbStr) => setPdbStr(pdbStr));
    },
    [pdbUrl],
  );

  return (
    <div>
      {pdbStr && (
        <MoleculeViewer
          moleculePayloads={[
            {
              pdbString: pdbStr,
              highlights: [highlight],
              structureHexColor: "#7279df",
            },
          ]}
        />
      )}
    </div>
  );
};
```

## Development

### Scripts

This project uses pnpm as the package manager. Here's a list of available scripts:

### Frequently Used in Local dev

- `dev`: Runs Storybook development server on port 6006.
- `format:fix`: Fixes code formatting issues using Prettier.
- `lint:fix`: Fixes linting issues automatically.
- `build`: Lints, builds the project, and generates CSS.
- `build-css`: Builds and minifies Tailwind CSS.
- `test`: Runs tests using Vitest.

### CI

- `build:ci`: Builds the project for CI environments.
- `build-storybook`: Builds Storybook for production.
- `format`: Checks code formatting using Prettier.
- `lint`: Runs TypeScript compiler and ESLint.

### Publishing/Library dev

- `publish`: Publishes the package to NPM.
- `prepublishOnly`: Runs linting, formatting, and build before publishing.
- `build:watch`: Watches for changes and rebuilds the project.
- `test:watch`: Runs tests in watch mode.

### Usage

To run a script, use:

```
pnpm <script-name>
```

For example:

```
pnpm dev
```

This will start the Storybook development server.
