import { Action, ActionPanel, Color, Icon, Keyboard, List } from "@raycast/api";
import { ReactNode } from "react";
import { getKubeconfigPath } from "../utils/kubeconfig-direct";

interface KubeconfigEmptyViewProps {
  /** Load error; when set, the view shows the error instead of "No Contexts Found". */
  error?: Error;
  /** Contexts exist but the search filtered them all out. */
  hasContexts?: boolean;
  searchText?: string;
  onRefresh: () => void;
  /** Extra leading actions (e.g. Create New Context). */
  children?: ReactNode;
}

/** Empty and error state shared by the list commands. */
export function KubeconfigEmptyView({ error, hasContexts, searchText, onRefresh, children }: KubeconfigEmptyViewProps) {
  const path = getKubeconfigPath();
  const action = (error as { action?: string } | undefined)?.action;

  return (
    <List.EmptyView
      icon={error ? { source: Icon.ExclamationMark, tintColor: Color.Red } : Icon.Document}
      title={error ? error.message : hasContexts ? "No Matching Contexts" : "No Contexts Found"}
      description={
        error ? action : hasContexts ? `No contexts match "${searchText ?? ""}"` : `Add a context to ${path}`
      }
      actions={
        <ActionPanel>
          {children}
          {!hasContexts && <Action.Open title="Open Kubeconfig" target={path} />}
          {!hasContexts && <Action.ShowInFinder path={path} />}
          <Action
            title="Refresh"
            icon={Icon.ArrowClockwise}
            onAction={onRefresh}
            shortcut={Keyboard.Shortcut.Common.Refresh}
          />
        </ActionPanel>
      }
    />
  );
}
