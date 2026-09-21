# Changelog

## [2026 Update] - {PR_MERGE_DATE}

### Added
- Preferences: Kubeconfig Path, Close Raycast After Switching, Production Pattern
- Production guard: contexts matching the pattern (default `prod|prd|live`) show a red icon and PROD tag, and switching to or deleting them asks for confirmation
- Pinned and Recent sections in Kube Contexts and Switch Context with Namespace
- Switch to Previous Context command (toggles between the last two contexts)
- Kubernetes Context menu bar command (refreshes every minute)
- Free-text namespace entry with RFC 1123 validation and recent namespaces per context
- Copy context name, server URL and kubectl command; open or reveal the kubeconfig
- EKS, AKS and GKE badges detected from the auth exec command or server host
- Optional cleanup of the cluster and user entries when deleting a context
- Explicit insecure opt-in when creating a cluster; TLS verification stays on by default
- Vitest suite covering kubeconfig I/O, operations, switching, recents, namespaces and cloud detection
- GitHub Actions workflow running tsc, eslint, prettier, tests and build

### Changed
- Upgrade to `@raycast/api` 2.x and `@raycast/utils` 2.x
- Migrate to ESLint 9 flat config; enable TypeScript `strict` mode, target ES2022
- Update `yaml`, `prettier`, `typescript`, `@types/*`; remove unused `@types/js-yaml`
- Each view command loads the kubeconfig once (cached by the resolved path)
- Lists use Raycast's native search across name, cluster, user, namespace and host; custom scoring removed
- All context switching goes through one shared helper
- Rewrite README and developer docs to match actual behavior

### Fixed
- Errors are shown over stale data; empty views distinguish no kubeconfig from no matches
- Pins and recents for deleted contexts are no longer shown and do not count towards the pin limit; pin failures are reported correctly
- Renaming a context carries its pin, recents, recent namespaces and previous-context entry; a LocalStorage read failure no longer wipes pins or recents
- Malformed kubeconfigs (non-list `contexts`/`clusters`/`users`, nameless entries) give a clear "Invalid kubeconfig" error; entries missing nested maps are tolerated
- Errors that cannot be shown in a window (menu bar) use a HUD
- A cluster is reported as secure only when it uses HTTPS and does not skip TLS verification
- Malformed users no longer break the list; cloud badges avoid false positives from generic CLIs
- Missing-kubeconfig hint mentions the `KUBECONFIG` environment variable

### Security
- Kubeconfig writes are atomic (temp file and rename), preserve comments, formatting and file mode (0600 for new files), and follow symlinks
- Writes take `<kubeconfig>.lock`, shared with kubectl, and refuse to overwrite a file whose modification time or size changed since it was read
- Writes are refused when the file changed on disk, the resolved path changed, or the lock is held (waits about 0.5 s, stale locks are never removed automatically)
- No backup file is left behind
- Resolve `npm audit` findings in runtime dependencies (`npm audit --omit=dev` is clean; one moderate advisory remains in the dev-only vitest test runner)

## [1.0.0] - {PR_MERGE_DATE}

### Added
- Initial release of Kubernetes Context Manager extension
