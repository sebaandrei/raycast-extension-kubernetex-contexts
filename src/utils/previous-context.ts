import { LocalStorage } from "@raycast/api";

const PREVIOUS_CONTEXT_KEY = "previousContext";

/**
 * Remembers the context we switched away from. Storage problems never fail a switch.
 */
export async function rememberPreviousContext(from: string | null | undefined, to: string): Promise<void> {
  if (!from || from === to) return;
  try {
    await LocalStorage.setItem(PREVIOUS_CONTEXT_KEY, from);
  } catch {
    // Best effort only
  }
}

export async function getPreviousContext(): Promise<string | null> {
  try {
    return (await LocalStorage.getItem<string>(PREVIOUS_CONTEXT_KEY)) ?? null;
  } catch {
    return null;
  }
}
