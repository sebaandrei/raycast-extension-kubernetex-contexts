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
- Kubeconfig is loaded once through a single cache keyed by the resolved path
- Lists use Raycast's native search across name, cluster, user, namespace and host; custom scoring removed
- All context switching goes through one shared helper
- Rewrite README and developer docs to match actual behavior

### Fixed
- Errors are shown over stale data; empty views distinguish no kubeconfig from no matches
- Stale pins and recents are dropped when a context is renamed or deleted; pin failures are reported correctly
- Malformed users no longer break the list; cloud badges avoid false positives from generic CLIs
- Missing-kubeconfig hint mentions the `KUBECONFIG` environment variable

### Security
- Kubeconfig writes are atomic (temp file and rename), preserve comments, formatting and file mode (0600 for new files), and follow symlinks
- Writes take `<kubeconfig>.lock`, shared with kubectl, and refuse to overwrite a file changed by another tool since it was read
- No backup file is left behind
- Resolve all `npm audit` vulnerabilities

## [1.0.0] - {PR_MERGE_DATE}

### Added
- Initial release of Kubernetes Context Manager extension
