import { LocalStorage } from "@raycast/api";
import { validateNamespace } from "./namespace";

const STORAGE_KEY = "recent-namespaces";
export const MAX_RECENT_NAMESPACES = 5;

export type RecentMap = Record<string, string[]>;
type ReadResult = { ok: true; value: RecentMap } | { ok: false };

/**
 * Read the stored map. Missing or corrupt content yields an empty map (`ok: true`); only a
 * failing `getItem` yields `ok: false`, so callers never overwrite data they could not read.
 */
export async function readRecentMap(): Promise<ReadResult> {
  let raw: string | undefined;
  try {
    raw = await LocalStorage.getItem<string>(STORAGE_KEY);
  } catch (error) {
    console.error(`Failed to read "${STORAGE_KEY}" from LocalStorage`, error);
    return { ok: false };
  }
  if (typeof raw !== "string") return { ok: true, value: {} };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return { ok: true, value: {} };
    return { ok: true, value: parsed as RecentMap };
  } catch (error) {
    console.warn(`Ignoring corrupt data stored under "${STORAGE_KEY}"`, error);
    return { ok: true, value: {} };
  }
}

/** Write the whole map. Returns false when the write failed. Never throws. */
export async function writeRecentMap(map: RecentMap, subject = "map"): Promise<boolean> {
  try {
    await LocalStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    return true;
  } catch (error) {
    console.error(`Failed to write "${STORAGE_KEY}" to LocalStorage (${subject})`, error);
    return false;
  }
}

export function entriesOf(map: RecentMap, contextName: string): string[] {
  const entries = Object.prototype.hasOwnProperty.call(map, contextName) ? map[contextName] : undefined;
  if (!Array.isArray(entries)) return [];
  // Sanitize on read: storage may hold legacy or corrupt data
  const valid = entries.filter((e): e is string => typeof e === "string" && validateNamespace(e) === undefined);
  return [...new Set(valid)].slice(0, MAX_RECENT_NAMESPACES);
}

/** Recently used namespaces of a context, most recent first. Never throws. */
export async function getRecentNamespaces(contextName: string): Promise<string[]> {
  const result = await readRecentMap();
  return result.ok ? entriesOf(result.value, contextName) : [];
}

/** Remember a namespace as most recently used for a context. Never throws; aborts if storage cannot be read. */
export async function rememberNamespace(contextName: string, namespace: string): Promise<void> {
  const result = await readRecentMap();
  if (!result.ok) return;
  const map = result.value;
  const updated = [namespace, ...entriesOf(map, contextName).filter((n) => n !== namespace)].slice(
    0,
    MAX_RECENT_NAMESPACES
  );
  await writeRecentMap({ ...map, [contextName]: updated }, contextName);
}
