# Copilot Instructions

## Scope

- This workspace is a Vite 5 single-page app built with Vue 3, TypeScript, Pinia, Vue Router, TDesign, Dockview, and editor-related packages.
- Use `pnpm` for all package and script commands. The lockfile is `pnpm-lock.yaml`.

## Code Style

- Prefer simple, direct solutions. Reduce nesting, remove redundant branches, and avoid unnecessary abstractions.
- Keep functions small and focused. Extract only when reuse or readability clearly improves.
- Use lower camelCase for function names, variables, computed values, refs, methods, and event handlers.
- Use lower camelCase for DOM class names in templates and styles, for example `leftMenu`, `panelHeader`, and `fileTreeItem`.
- Do not introduce ALL_CAPS constants. Prefer descriptive lower camelCase names such as `editorConfig`, `requestTimeout`, and `panelWidth`.
- Reuse existing helpers and store actions before adding new utility layers.
- Preserve the current file organization: route shells in `src/pages`, feature implementations in `src/views`, shared logic in `src/utils` and `src/stores`.
- **Use lower camelCase for all file names and folder names**, for example `userStore.ts`, `fileTree.ts`, `apiHelper.ts`, `editorPanel/`, `contextMenu/`. This applies to every new file or directory created under `src/` without exception.
- **Never use kebab-case, snake_case, PascalCase, or UPPER_CASE for file or folder names.** Existing exceptions in the project should not be treated as a precedent for new work.
- **Component file names must also follow lower camelCase**, for example `tabHeader.ts`, `splitPane.ts`, `loginForm.ts`, not `TabHeader.ts` or `tab-header.ts`.
