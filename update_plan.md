# Update Plan: Kubernetes Context Manager (2026)

Follow tasks in order, one at a time. Each task ends with the **Definition of done** checks and its own commit.

## Decisions (from planning Q&A)

| Topic | Decision |
|---|---|
| Scope | Full roadmap |
| Distribution | Raycast Store (final task covers compliance) |
| Kubeconfig files | Single path preference. Fallback: first `KUBECONFIG` entry, then `~/.kube/config`. No multi-file merge |
| Namespaces | Static list plus free-text entry. No kubectl dependency |
| Backup file | Remove. Replace with atomic write |
| AI tool | Deferred (needs Raycast Pro, needs confirmation flow). Not in this plan |

## Definition of done (every task)

- `npx tsc --noEmit` clean
- `npx eslint src` clean
- `npx prettier --check src` clean
- `npm run build` succeeds
- Manual smoke test in `npm run dev` for touched commands
- One focused commit

## Baseline findings this plan addresses

Backup file world-readable, non-atomic writes, comments lost on rewrite, new clusters default to `insecure-skip-tls-verify`, no delete confirmation, dangling refs on modify, no path preference, in-memory "recents" that reset every run, errors swallowed to `false`, 4-5 file parses per mount, duplicated switch logic, fake list rows for empty and error states, docs that claim features that do not exist.

---

## Task 0: Baseline commit

**Goal:** Land the dependency and tooling upgrade already done, on a branch.

- Create branch `update-2026`.
- Commit: package.json, package-lock.json, eslint.config.js (replaces .eslintrc.json), tsconfig.json (strict), kubeconfig-direct.ts type fix, CHANGELOG.md.

**Done when:** clean `git status`, build passes.

---

## Task 1: Preferences and kubeconfig path resolution

**Goal:** Users can set the kubeconfig path. Raycast often does not inherit shell env.

**Files:** `package.json`, `src/utils/preferences.ts` (new), `src/utils/kubeconfig-direct.ts`

- Add extension-level preferences in package.json:
  - `kubeconfigPath` (textfield, optional, placeholder `~/.kube/config`)
  - `closeAfterSwitch` (checkbox, default true)
  - `productionPattern` (textfield, default `prod|prd|live`, used in Task 7)
- `getKubeconfigPath()` order: preference (expand `~`) → first entry of `KUBECONFIG` split on `:` → `~/.kube/config`.
- Export a way to pass the path explicitly (`readKubeconfig(path?)`) so tests in Task 4 can use temp files.
- Show resolved path in error messages and Current Context view.

**Done when:** setting the preference changes which file is read and written; colon-separated `KUBECONFIG` no longer breaks.

---

## Task 2: Safe kubeconfig I/O

**Goal:** No data loss, no leaked credentials, no comment loss.

**Files:** `src/utils/kubeconfig-direct.ts`

- Read with `yaml.parseDocument` and keep the Document for edits, so comments, order and quoting survive.
- Write atomically: temp file in the same directory, `fsync`, `rename`. Preserve original file mode (`statSync().mode`); default `0600` for new files.
- Remove the `.backup` file logic entirely (also drop `*.backup` from .raycastignore if unneeded).
- Before writing, compare `mtime` with the value at read time. If changed, throw a clear "kubeconfig changed on disk, retry" error.
- Detect errors by `error.code` (`EACCES`, `ENOENT`, `ENOSPC`) and `YAMLParseError`, not message text.

**Done when:** editing a config with comments keeps them; killing the process mid-write cannot leave a truncated file; no extra files with credentials appear next to the config.

---

## Task 3: Harden context operations

**Goal:** Operations are correct and report real errors.

**Files:** `src/utils/kubeconfig-direct.ts`, `src/utils/errors.ts`, callers

- Functions throw typed errors instead of returning `false` (`switchToContext`, `setContextNamespace`, `switchToContextWithNamespace`). Callers surface the message.
- `createContext`: new clusters get TLS verification on (no `insecure-skip-tls-verify`). Add an explicit optional "skip TLS verify" field in the create form, default off, with a warning label.
- `modifyContext`: validate the target cluster and user exist. If a manual name is entered that does not exist, create it (same rules as create) or reject with a clear message.
- `deleteContext`: add option to also remove clusters and users no longer referenced by any context (form checkbox, default off).
- Collapse the duplicated "find context and mutate" code into small internal helpers.

**Done when:** every failure path shows a specific, actionable message; no dangling references possible from the UI.

---

## Task 4: Unit tests (Vitest)

**Goal:** Safety net for the write path before more features.

**Files:** `package.json` (devDep `vitest`, script `test`), `src/utils/__tests__/kubeconfig-direct.test.ts`, `src/utils/__tests__/search-filter.test.ts` (only if the custom search survives Task 8)

- Use temp directories and the explicit-path API from Task 1.
- Cover: read valid, empty, invalid YAML, missing file; switch; set namespace; create (TLS default, missing cluster, missing user); modify (rename current context, unknown cluster); delete (current context refused, orphan cleanup); comment preservation; atomic write leaves no temp file; mtime conflict.
- Keep tests free of `@raycast/api` imports.

**Done when:** `npm test` passes and covers all mutating functions.

---

## Task 5: Data layer rewrite

**Goal:** One parse per load, stable callbacks, less code.

**Files:** `src/hooks/useKubeconfig.ts`, all commands, `src/components/ContextDetails.tsx`

- Replace the five separate hooks with one `useCachedPromise` (from `@raycast/utils`) returning contexts, current context, namespaces and file info from a single read.
- Expose `revalidate` as refresh and use optimistic mutate for switch.
- `ContextDetails` receives `onSwitch` via props instead of mounting the whole hook.
- Forms read clusters and users once (memoised), not on every render.

**Done when:** opening any command parses the kubeconfig exactly once (verify with a temporary log).

---

## Task 6: Shared switch helper

**Goal:** One place for switch, feedback and closing.

**Files:** `src/utils/switch.ts` (new), `src/list-contexts.tsx`, `src/current-context.tsx`, `src/switch-context-namespace.tsx`, `src/components/ContextDetails.tsx`

- `switchAndClose(contextName, { namespace? })`: performs the switch, shows a HUD (`showHUD`) with the context name and namespace, closes the window per `closeAfterSwitch`. On error, `showFailureToast` with the real message.
- Store the previous context here (used in Task 11).
- Replace the four copies of switch and toast logic. Fix the silent failure in `current-context.tsx`.

**Done when:** all switch paths behave identically; grep shows one implementation.

---

## Task 7: Production guard

**Goal:** Prevent accidental switches to production.

**Files:** `src/utils/switch.ts`, `src/utils/environment.ts` (new), list views

- `isProduction(context)` tests the `productionPattern` preference (case-insensitive regex, invalid regex falls back to default with a toast once).
- `switchAndClose` asks `confirmAlert` (destructive style) for production contexts before switching.
- Production contexts get a red tinted icon and a "PROD" tag accessory in all lists.
- Add confirmation to Delete in Manage Contexts (all contexts, stronger wording for production).

**Done when:** switching to a matching context always prompts; non-matching switches unchanged.

---

## Task 8: UI cleanup and native search

**Goal:** Native-feeling lists, less code.

**Files:** all command files, `src/utils/search-filter.ts`, `src/components/*`

- Use `List.EmptyView` for empty and error states (with actions: open kubeconfig, refresh). Remove fake rows and emoji accessories.
- Use Raycast's native filtering with `keywords` (cluster, user, namespace, server host). Remove relevance % and the custom fuzzy engine. Delete unused `getRecentContexts` (in-memory), `highlightMatches`, `getFilterOptions`.
- Use `List.Item.Detail` or Detail metadata instead of long subtitle strings where it helps readability.
- Fix wording in `ContextDetails` ("List Contexts" → "Kube Contexts"). Escape markdown-sensitive values.
- Use `Icon` with `tintColor` for current context.

**Done when:** searching by cluster, user and namespace still finds contexts; lists have no emoji text.

---

## Task 9: Free-text namespaces

**Goal:** Any namespace can be chosen.

**Files:** `src/components/NamespaceSelector.tsx`, `src/utils/kubeconfig-direct.ts`

- When the search text is not in the list, show a top item "Use namespace `<text>`" that selects it.
- Validate against RFC 1123 label rules (lowercase alphanumerics and `-`, max 63 chars); show an inline error otherwise.
- Remember recently used namespaces per context (LocalStorage) and list them first.

**Done when:** a namespace not in the list can be set and is written to the kubeconfig.

---

## Task 10: Recents and pinned

**Goal:** Fast access to frequent contexts, persisted.

**Files:** `src/utils/recents.ts` (new), `src/list-contexts.tsx`, `src/switch-context-namespace.tsx`

- Persist recents (max 5) and pinned names with `LocalStorage`.
- Lists show sections: Pinned, Recent, All. Actions: Pin / Unpin (`cmd+shift+p`), Move up/down optional.
- Drop entries that no longer exist in the kubeconfig.

**Done when:** recents survive closing and reopening Raycast; pinned appear first.

---

## Task 11: Switch to previous context (no-view command)

**Goal:** `kubectx -` equivalent bound to a hotkey.

**Files:** `package.json` (new command `previous-context`, mode `no-view`), `src/previous-context.ts`

- Read previous context stored by the switch helper; swap current and previous; HUD feedback.
- If none stored or it no longer exists, HUD explains why.
- Production guard from Task 7 applies.

**Done when:** running the command toggles between the last two contexts.

---

## Task 12: Menu bar command

**Goal:** Current context always visible and switchable.

**Files:** `package.json` (command `menu-bar`, mode `menu-bar`, `interval: "1m"`), `src/menu-bar.tsx`

- Title: context name (truncate long names), tinted red for production.
- Menu: Current section (namespace, cluster), Pinned, Recent, All contexts (submenu if more than about 10), Open Kubeconfig, Refresh.
- Uses the shared data layer and switch helper.
- No file watcher, so document the refresh interval.

**Done when:** menu bar reflects the kubeconfig within the interval and switching works, including the production prompt.

---

## Task 13: Convenience actions and cloud badges

**Goal:** Small polish with high daily value.

**Files:** list views, `ContextDetails`, `src/utils/kubeconfig-direct.ts`

- Actions: copy context name, copy server URL, copy `kubectl --context <name> -n <ns>` command, open kubeconfig in default editor, reveal in Finder.
- Cloud badge from exec command or server host: `aws` / `.eks.amazonaws.com` → EKS, `kubelogin` / `.azmk8s.io` → AKS, `gke-gcloud-auth-plugin` / `container.googleapis.com` → GKE. Also detect `tokenFile` as an auth method.

**Done when:** actions appear in the action panel with sensible shortcuts; badges show for matching contexts.

---

## Task 14: Docs and Store readiness

**Goal:** Ready to submit to `raycast/extensions`.

- Rewrite CLAUDE.md and README to match reality (remove claims about file monitoring and backups; document preferences, commands, shortcuts, safety behavior).
- package.json: `author` = Raycast username (**needs your Raycast handle**), plain command titles in Title Case, descriptions without emoji, keep the 512x512 icon.
- Keep `metadata/` screenshots (2000x1250 PNG). Refresh them for the menu bar and new list layout using Raycast's window capture.
- CHANGELOG entries with `{PR_MERGE_DATE}` placeholder per release.
- Run `npm run lint` (`ray lint`; it hung during the first pass, so verify it completes) and `npm run build`.
- If keeping the repo standalone: add a GitHub Actions workflow running tsc, eslint, prettier, tests and build. Skip if only submitting to the store.
- Open PR against `raycast/extensions` following their contribution guide.

**Done when:** `ray lint` passes, docs match behavior, store PR is ready.

---

## Order summary

| # | Task | Type |
|---|---|---|
| 0 | Baseline commit | Setup |
| 1 | Preferences and path | Fix |
| 2 | Safe I/O | Fix (security) |
| 3 | Harden operations | Fix |
| 4 | Unit tests | Safety net |
| 5 | Data layer | Refactor |
| 6 | Shared switch helper | Refactor |
| 7 | Production guard | Feature |
| 8 | UI cleanup | Refactor |
| 9 | Free-text namespaces | Feature |
| 10 | Recents and pinned | Feature |
| 11 | Previous context | Feature |
| 12 | Menu bar | Feature |
| 13 | Actions and badges | Feature |
| 14 | Docs and Store | Release |

## Open items

- Raycast username for package.json `author` (Task 14).
- Confirm the default production pattern `prod|prd|live` (Task 1).
