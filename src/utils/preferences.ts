import { getPreferenceValues } from "@raycast/api";

export function getPreferences(): ExtensionPreferences {
  return getPreferenceValues<ExtensionPreferences>();
}
