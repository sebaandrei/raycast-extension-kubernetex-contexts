# Kubernetes Context Manager

A Raycast extension for switching and managing Kubernetes contexts. It reads and edits the kubeconfig file directly, so kubectl does not need to be installed.

## Commands

| Command | Mode | Description |
| --- | --- | --- |
| Kube Contexts | view | List contexts with Raycast's native search (name, cluster, user, namespace, host). Pinned, Recent and All sections. Switch, pin, view details, copy and open actions. |
| Current Context | view | Details of the active context: server, host, port, protocol, auth method, TLS settings. Quick switching to other contexts. |
| Switch Context with Namespace | view | Two steps: pick a context, then a namespace. Namespaces come from the kubeconfig; a free-text name (RFC 1123 validated) is also accepted. Recent namespaces are remembered per context. |
| Manage Contexts | view | Create contexts (TLS verification on by default, insecure is an explicit opt-in), modify cluster, user and namespace of existing ones, delete with confirmation and optional cleanup of the now-unused cluster and user (the active context cannot be deleted from the UI). |
| Switch to Previous Context | no-view | Toggles between the last two contexts (A and B). |
| Kubernetes Context | menu bar | Shows the current context and lets you switch. Refreshes every minute and when opened. |

## Preferences

| Preference | Description |
| --- | --- |
| Kubeconfig Path | Path to the kubeconfig file. Empty: first entry of `$KUBECONFIG`, else `~/.kube/config`. |
| Close Raycast After Switching | Return to the main Raycast window after a successful switch (default on). |
| Production Pattern | Case-insensitive regex tested against the context name (default `prod\|prd\|live`, empty disables). Matching contexts get a red icon and PROD tag, and switching to or deleting them asks for confirmation. |

## Safety

Writes to the kubeconfig (`src/utils/kubeconfig-io.ts`):

- Comments and formatting are preserved.
- Writes are atomic: temp file in the same directory, then rename.
- File mode is preserved (0600 for newly created files). Symlinks are followed.
- `<kubeconfig>.lock` is held during a write, the same lock kubectl uses.
- A write is refused if the file's modification time or size changed since it was read (best effort; it is not a content hash).
- No backup file is left behind.

## Keyboard shortcuts

| Shortcut | Where | Action |
| --- | --- | --- |
| Cmd+Shift+Enter | Switch Context with Namespace | Quick switch without choosing a namespace |
| Cmd+Shift+P | Kube Contexts, Switch Context with Namespace | Pin or unpin |
| Cmd+1 to Cmd+5 | Current Context | Switch to the listed context |
| Cmd+Shift+C | Context actions | Copy context name |
| Cmd+Opt+S | Context actions | Copy server URL |
| Cmd+Opt+K | Context actions | Copy kubectl command |
| Cmd+R | Current Context, Manage Contexts, and the empty/error views of the lists | Refresh |
| Cmd+E, Ctrl+X, Ctrl+Shift+X | Manage Contexts | Edit, delete, delete and remove unused cluster/user (Raycast common shortcuts) |

Other actions (details, open kubeconfig, show in Finder) have no shortcut.

## Cloud provider badges

Shown as EKS, AKS or GKE, detected from the user's exec auth command first (`aws-iam-authenticator`, `aws ... eks ...`, `kubelogin`, `gke-gcloud-auth-plugin`), then from the server host (`*.eks.amazonaws.com`, `*.azmk8s.io`, `container.googleapis.com`). Generic CLIs such as `az` or `gcloud` alone do not produce a badge.

Authentication is detected from the user entry: token, client certificate, basic auth, exec, auth provider.

## Limitations

- One kubeconfig file. There is no multi-file merge; when the preference is empty only the first `$KUBECONFIG` entry is used.
- Namespaces are the common ones (`default`, `kube-system`, `kube-public`, `kube-node-lease`), those found in the kubeconfig, and anything you type. There is no live cluster lookup.
- The menu bar is refreshed on an interval, not live. There is no file watcher; use Refresh after external changes.
- Pins and recents are stored locally in Raycast LocalStorage. Entries for a renamed or deleted context are no longer shown (a rename does not carry the pin over).

## Development

```bash
npm install
npm run dev      # ray develop
npm test         # vitest
npm run lint     # ray lint
npm run build    # ray build
```

Screenshots in `metadata/` predate the menu bar command and the Pinned/Recent layout and still need refreshing with Raycast's window capture (2000x1250 PNG).
