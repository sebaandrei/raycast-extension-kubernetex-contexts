# Kubernetes Context Manager

A Raycast extension for switching and managing Kubernetes contexts. It reads and edits the kubeconfig file directly, so kubectl does not need to be installed.

## Commands

| Command | Mode | Description |
| --- | --- | --- |
| Kube Contexts | view | List contexts with Raycast's native search (name, cluster, user, namespace, host). Pinned, Recent and All sections. Switch, pin, view details, copy and open actions. |
| Current Context | view | Details of the active context: server, host, port, protocol, auth method, TLS settings. Quick switching to other contexts. |
| Switch Context with Namespace | view | Two steps: pick a context, then a namespace. Namespaces come from the kubeconfig; a free-text name (RFC 1123 validated) is also accepted. Recent namespaces are remembered per context when a namespace is picked (Quick Switch does not record one). |
| Manage Contexts | view | Create contexts (TLS verification on by default, insecure is an explicit opt-in), rename contexts and modify their cluster, user and namespace, delete with confirmation and optional cleanup of the now-unused cluster and user (the active context cannot be deleted from the UI). |
| Switch to Previous Context | no-view | Toggles between the last two contexts switched through this extension (switches made with kubectl are not tracked). |
| Kubernetes Context | menu bar | Shows the current context and lets you switch (always with a HUD; the window is not closed). Refreshes every minute and when opened. |

## Preferences

| Preference | Description |
| --- | --- |
| Kubeconfig Path | Path to the kubeconfig file. Empty: first entry of `$KUBECONFIG`, else `~/.kube/config`. |
| Close Raycast After Switching | Return to the main Raycast window after a successful switch (default on). |
| Production Pattern | Case-insensitive regex tested against the context name (default `prod\|prd\|live`). An invalid regex falls back to the default pattern and shows a toast; an empty or whitespace-only value disables the guard. Matching contexts get a red icon and PROD tag, and switching to or deleting them asks for confirmation. |

## Safety

Writes to the kubeconfig (`src/utils/kubeconfig-io.ts`):

- Comments and formatting are preserved.
- Writes are atomic: temp file in the same directory, then rename.
- File mode is preserved (0600 for newly created files). Symlinks are followed.
- `<kubeconfig>.lock` is held during a write, the same lock kubectl uses. If it is already held, the write waits about 0.5 s, then fails with a hint to delete the stale lock file; a stale lock is never removed automatically.
- A write is refused if the file's modification time or size changed since it was read (best effort; it is not a content hash), or if the resolved kubeconfig path changed while editing.
- A kubeconfig whose `contexts`, `clusters` or `users` is not a list, or that has entries without a `name`, is rejected with an "Invalid kubeconfig" error; entries missing their nested `context`/`cluster`/`user` map are tolerated.
- No backup file is left behind.

## Keyboard shortcuts

| Shortcut | Where | Action |
| --- | --- | --- |
| Cmd+Shift+Enter | Switch Context with Namespace | Quick switch without choosing a namespace |
| Cmd+Shift+P | Kube Contexts, Switch Context with Namespace | Pin or unpin |
| Cmd+1 to Cmd+5 | Current Context | Switch to the listed context |
| Cmd+Shift+. | Context actions | Copy context name (Raycast common shortcut) |
| Cmd+Opt+S | Context actions | Copy server URL |
| Cmd+Opt+K | Context actions | Copy kubectl command |
| Cmd+R | Current Context, Manage Contexts, and the empty/error views of the lists | Refresh |
| Cmd+E, Ctrl+X, Ctrl+Shift+X | Manage Contexts | Edit, delete, delete and remove unused cluster/user (Raycast common shortcuts) |

Other actions (details, open kubeconfig, show in Finder) have no shortcut.

## Cloud provider badges

Shown as EKS, AKS or GKE, detected from the user's exec auth command first (`aws-iam-authenticator`, `aws ... eks ...`, `kubelogin`, `gke-gcloud-auth-plugin`), then from the server host (`*.eks.amazonaws.com`, `*.azmk8s.io`, `container.googleapis.com`). Generic CLIs such as `az` or `gcloud` alone do not produce a badge.

Authentication is detected from the user entry: token, token file, client certificate, basic auth, exec, auth provider.

## Limitations

- One kubeconfig file. There is no multi-file merge; when the preference is empty only the first `$KUBECONFIG` entry is used.
- Namespaces are the common ones (`default`, `kube-system`, `kube-public`, `kube-node-lease`), those found in the kubeconfig, and anything you type. There is no live cluster lookup.
- The menu bar is refreshed on an interval, not live. There is no file watcher; use Refresh after external changes.
- Pins and recents are stored locally in Raycast LocalStorage. Entries for a deleted context are no longer shown. Renaming a context in Manage Contexts carries its pin, recents, recent namespaces and previous-context entry over. A LocalStorage read failure does not wipe stored pins or recents.

## Development

```bash
npm install
npm run dev      # ray develop
npm test         # vitest
npm run lint     # ray lint
npm run build    # ray build
```

Screenshots in `metadata/` predate the menu bar command and the Pinned/Recent layout and still need refreshing with Raycast's window capture (2000x1250 PNG).
