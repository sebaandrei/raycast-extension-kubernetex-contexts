import { LocalStorage } from "@raycast/api";

const RECENT_KEY = "recent-contexts";
const PINNED_KEY = "pinned-contexts";
export const MAX_RECENT_CONTEXTS = 5;
export const MAX_PINNED_CONTEXTS = 20;

async function readNames(key: string, max: number): Promise<string[]> {
  try {
    const raw = await LocalStorage.getItem<string>(key);
    if (typeof raw !== "string") return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Sanitize on read: storage may hold legacy or corrupt data
    const valid = parsed.filter((n): n is string => typeof n === "string" && n.length > 0);
    return [...new Set(valid)].slice(0, max);
  } catch {
    return [];
  }
}

/** Recently switched-to contexts, most recent first. Never throws. */
export function getRecentContexts(): Promise<string[]> {
  return readNames(RECENT_KEY, MAX_RECENT_CONTEXTS);
}

/** Remember a context as most recently used. Never throws. */
export async function rememberContext(name: string): Promise<void> {
  try {
    const current = await readNames(RECENT_KEY, MAX_RECENT_CONTEXTS);
    const updated = [name, ...current.filter((n) => n !== name)].slice(0, MAX_RECENT_CONTEXTS);
    await LocalStorage.setItem(RECENT_KEY, JSON.stringify(updated));
  } catch {
    // Recents are a convenience; ignore storage failures
  }
}

/** Pinned contexts in pin order. Never throws. */
export function getPinnedContexts(): Promise<string[]> {
  return readNames(PINNED_KEY, MAX_PINNED_CONTEXTS);
}

/** Pin or unpin a context. Returns the new pinned state (false on failure or when the pin limit is reached). Never throws. */
export async function togglePin(name: string): Promise<boolean> {
  try {
    const current = await readNames(PINNED_KEY, MAX_PINNED_CONTEXTS);
    if (current.includes(name)) {
      await LocalStorage.setItem(PINNED_KEY, JSON.stringify(current.filter((n) => n !== name)));
      return false;
    }
    if (current.length >= MAX_PINNED_CONTEXTS) return false;
    await LocalStorage.setItem(PINNED_KEY, JSON.stringify([...current, name]));
    return true;
  } catch {
    return false;
  }
}
