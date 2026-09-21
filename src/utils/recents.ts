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

export type TogglePinResult = { ok: true; pinned: boolean } | { ok: false; reason: "limit" | "storage" };

/**
 * Pin or unpin a context. Pins for contexts not in `existing` (deleted or renamed) are
 * dropped first so they cannot use up the pin limit. Never throws.
 */
export async function togglePin(name: string, existing?: string[]): Promise<TogglePinResult> {
  try {
    const stored = await readNames(PINNED_KEY, MAX_PINNED_CONTEXTS);
    const current = existing ? stored.filter((n) => existing.includes(n)) : stored;

    if (current.includes(name)) {
      await LocalStorage.setItem(PINNED_KEY, JSON.stringify(current.filter((n) => n !== name)));
      return { ok: true, pinned: false };
    }
    if (current.length >= MAX_PINNED_CONTEXTS) return { ok: false, reason: "limit" };
    await LocalStorage.setItem(PINNED_KEY, JSON.stringify([...current, name]));
    return { ok: true, pinned: true };
  } catch {
    return { ok: false, reason: "storage" };
  }
}
