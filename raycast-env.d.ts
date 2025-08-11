/// <reference types="@raycast/api">

/* 🚧 🚧 🚧
 * This file is auto-generated from the extension's manifest.
 * Do not modify manually. Instead, update the `package.json` file.
 * 🚧 🚧 🚧 */

/* eslint-disable @typescript-eslint/ban-types */

type ExtensionPreferences = {}

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
}

