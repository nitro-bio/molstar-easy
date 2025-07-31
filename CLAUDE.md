# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build, Lint, Test Commands

- 🏗️ Build: `pnpm build`
- 🧹 Lint: `pnpm lint` or `pnpm lint:fix` to auto-fix issues
- 🎨 Format: `pnpm format` or `pnpm format:fix` to auto-fix format issues
- 🧪 Test: `pnpm test` (run all) or `pnpm test path/to/file.test.ts` (single test)
- 🔄 Dev: `pnpm dev` (starts Vite dev server)

## Code Style Guidelines

- TypeScript with strict typing enabled
- React functional components with hooks
- Use path aliases: `@utils/*` for imports from src/utils/\*
- Follow existing formatting using Prettier + TailwindCSS plugin
- Use ESLint for code quality
- Use Tailwind CSS for styling
- Prefer named exports over default exports
- Imports ordering: React/libraries → internal modules → types/styles
- Handle errors with react-error-boundary
- Use descriptive variable names and follow PascalCase for components
