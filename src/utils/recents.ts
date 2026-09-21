import { LocalStorage } from "@raycast/api";

const RECENT_KEY = "recent-contexts";
const PINNED_KEY = "pinned-contexts";
export const MAX_RECENT_CONTEXTS = 5;
export const MAX_PINNED_CONTEXTS = 20;

export type ContextListKind = "recent" | "pinned";
export type ReadResult<T> = { ok: true; value: T } | { ok: false };

const LIST_CONFIG: Record<ContextListKind, { key: string; max: number }> = {
  recent: { key: RECENT_KEY, max: MAX_RECENT_CONTEXTS },
  pinned: { key: PINNED_KEY, max: MAX_PINNED_CONTEXTS },
};

/**
 * Read a stored name list. Missing, invalid or corrupt content yields an empty list
 * (`ok: true`); only a failing `getItem` yields `ok: false`, so callers can avoid
 * overwriting data they could not read.
 */
async function readNames(key: string, max: number): Promise<ReadResult<string[]>> {
  let raw: string | undefined;
  try {
    raw = await LocalStorage.getItem<string>(key);
  } catch (error) {
    console.error(`Failed to read "${key}" from LocalStorage`, error);
    return { ok: false };
  }
  if (typeof raw !== "string") return { ok: true, value: [] };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return { ok: true, value: [] };
    // Sanitize on read: storage may hold legacy or corrupt data
    const valid = parsed.filter((n): n is string => typeof n === "string" && n.length > 0);
    return { ok: true, value: [...new Set(valid)].slice(0, max) };
  } catch (error) {
    console.warn(`Ignoring corrupt data stored under "${key}"`, error);
    return { ok: true, value: [] };
  }
}

async function writeNames(key: string, names: string[], subject: string): Promise<boolean> {
  try {
    await LocalStorage.setItem(key, JSON.stringify(names));
    return true;
  } catch (error) {
    console.error(`Failed to write "${key}" to LocalStorage (${subject})`, error);
    return false;
  }
}

/** Read the stored recents or pins, telling a failed read apart from an empty list. Never throws. */
export function readContextList(kind: ContextListKind): Promise<ReadResult<string[]>> {
  return readNames(LIST_CONFIG[kind].key, LIST_CONFIG[kind].max);
}

/** Replace the stored recents or pins. Returns false when the write failed. Never throws. */
export function writeContextList(kind: ContextListKind, names: string[], subject = "list"): Promise<boolean> {
  return writeNames(LIST_CONFIG[kind].key, names.slice(0, LIST_CONFIG[kind].max), subject);
}

/** Recently switched-to contexts, most recent first (up to 5, may include names no longer in the kubeconfig). Never throws. */
export async function getRecentContexts(): Promise<string[]> {
  const result = await readNames(RECENT_KEY, MAX_RECENT_CONTEXTS);
  return result.ok ? result.value : [];
}

/** Remember a context as most recently used. Never throws; aborts without writing if storage cannot be read. */
export async function rememberContext(name: string): Promise<void> {
  const current = await readNames(RECENT_KEY, MAX_RECENT_CONTEXTS);
  if (!current.ok) return;
  const updated = [name, ...current.value.filter((n) => n !== name)].slice(0, MAX_RECENT_CONTEXTS);
  await writeNames(RECENT_KEY, updated, name);
}

/** Pinned contexts in pin order. Never throws. */
export async function getPinnedContexts(): Promise<string[]> {
  const result = await readNames(PINNED_KEY, MAX_PINNED_CONTEXTS);
  return result.ok ? result.value : [];
}

export type TogglePinResult = { ok: true; pinned: boolean } | { ok: false; reason: "limit" | "storage" };

/**
 * Pin or unpin a context. Drops stale pins (contexts not in `existing`) only when `existing` is
 * provided, so they cannot use up the pin limit. Never throws.
 */
export async function togglePin(name: string, existing?: string[]): Promise<TogglePinResult> {
  const stored = await readNames(PINNED_KEY, MAX_PINNED_CONTEXTS);
  if (!stored.ok) return { ok: false, reason: "storage" };
  const current = existing ? stored.value.filter((n) => existing.includes(n)) : stored.value;

  if (current.includes(name)) {
    const ok = await writeNames(
      PINNED_KEY,
      current.filter((n) => n !== name),
      name
    );
    return ok ? { ok: true, pinned: false } : { ok: false, reason: "storage" };
  }
  if (current.length >= MAX_PINNED_CONTEXTS) return { ok: false, reason: "limit" };
  const ok = await writeNames(PINNED_KEY, [...current, name], name);
  return ok ? { ok: true, pinned: true } : { ok: false, reason: "storage" };
}
