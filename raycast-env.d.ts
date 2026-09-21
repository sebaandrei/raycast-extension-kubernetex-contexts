/// <reference types="@raycast/api">

/* 🚧 🚧 🚧
 * This file is auto-generated from the extension's manifest.
 * Do not modify manually. Instead, update the `package.json` file.
 * 🚧 🚧 🚧 */

/* eslint-disable @typescript-eslint/ban-types */

type ExtensionPreferences = {
  /** Kubeconfig Path - Path to the kubeconfig file. Leave empty to use the first entry of $KUBECONFIG or ~/.kube/config. */
  "kubeconfigPath"?: string,
  /** Switching - Return to the main Raycast window after a successful context switch. */
  "closeAfterSwitch": boolean,
  /** Production Pattern - Case-insensitive regular expression tested against the context name (substring match; use ^ and $ to anchor, e.g. ^prod-). Matching contexts are treated as production and require confirmation before switching. Leave empty to disable. */
  "productionPattern": string
}

/** Preferences accessible in all the extension's commands */
declare type Preferences = ExtensionPreferences

declare namespace Preferences {
  /** Preferences accessible in the `list-contexts` command */
  export type ListContexts = ExtensionPreferences & {}
  /** Preferences accessible in the `current-context` command */
  export type CurrentContext = ExtensionPreferences & {}
  /** Preferences accessible in the `switch-context-namespace` command */
  export type SwitchContextNamespace = ExtensionPreferences & {}
  /** Preferences accessible in the `manage-contexts` command */
  export type ManageContexts = ExtensionPreferences & {}
  /** Preferences accessible in the `previous-context` command */
  export type PreviousContext = ExtensionPreferences & {}
}

declare namespace Arguments {
  /** Arguments passed to the `list-contexts` command */
  export type ListContexts = {}
  /** Arguments passed to the `current-context` command */
  export type CurrentContext = {}
  /** Arguments passed to the `switch-context-namespace` command */
  export type SwitchContextNamespace = {}
  /** Arguments passed to the `manage-contexts` command */
  export type ManageContexts = {}
  /** Arguments passed to the `previous-context` command */
  export type PreviousContext = {}
}

