import { LocalStorage } from "@raycast/api";

const PREVIOUS_CONTEXT_KEY = "previousContext";

/** Store the previous context name. Returns false on failure. Never throws. */
export async function setPreviousContext(name: string): Promise<boolean> {
  try {
    await LocalStorage.setItem(PREVIOUS_CONTEXT_KEY, name);
    return true;
  } catch (error) {
    console.error(`Failed to remember previous context "${name}"`, error);
    return false;
  }
}

/**
 * Remembers the context we switched away from. Storage problems never fail a switch.
 */
export async function rememberPreviousContext(from: string | null | undefined, to: string): Promise<void> {
  if (!from || from === to) return;
  await setPreviousContext(from);
}

export async function getPreviousContext(): Promise<string | null> {
  try {
    const value = await LocalStorage.getItem<string>(PREVIOUS_CONTEXT_KEY);
    return typeof value === "string" ? value : null;
  } catch (error) {
    console.error(`Failed to read "${PREVIOUS_CONTEXT_KEY}" from LocalStorage`, error);
    return null;
  }
}
