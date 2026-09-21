import { Action, ActionPanel, Color, Icon, Keyboard, List } from "@raycast/api";
import { ReactNode } from "react";
import { getKubeconfigPath } from "../utils/kubeconfig-direct";

interface KubeconfigEmptyViewProps {
  /** Load error; when set, the view shows the error instead of "No Contexts Found". */
  error?: Error;
  onRefresh: () => void;
  /** Extra leading actions (e.g. Create New Context). */
  children?: ReactNode;
}

/** Empty and error state shared by the list commands. */
export function KubeconfigEmptyView({ error, onRefresh, children }: KubeconfigEmptyViewProps) {
  const path = getKubeconfigPath();
  const action = (error as { action?: string } | undefined)?.action;

  return (
    <List.EmptyView
      icon={error ? { source: Icon.ExclamationMark, tintColor: Color.Red } : Icon.Document}
      title={error ? error.message : "No Contexts Found"}
      description={error ? action : `Add a context to ${path}`}
      actions={
        <ActionPanel>
          {children}
          <Action.Open title="Open Kubeconfig" target={path} />
          <Action.ShowInFinder path={path} />
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
