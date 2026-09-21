import { LocalStorage } from "@raycast/api";

const STORAGE_KEY = "recent-namespaces";
export const MAX_RECENT_NAMESPACES = 5;

type RecentMap = Record<string, string[]>;

async function readMap(): Promise<RecentMap> {
  try {
    const raw = await LocalStorage.getItem<string>(STORAGE_KEY);
    if (typeof raw !== "string") return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as RecentMap;
  } catch {
    return {};
  }
}

function entriesOf(map: RecentMap, contextName: string): string[] {
  const entries = Object.prototype.hasOwnProperty.call(map, contextName) ? map[contextName] : undefined;
  return Array.isArray(entries) ? entries.filter((e): e is string => typeof e === "string") : [];
}

/** Recently used namespaces of a context, most recent first. Never throws. */
export async function getRecentNamespaces(contextName: string): Promise<string[]> {
  return entriesOf(await readMap(), contextName);
}

/** Remember a namespace as most recently used for a context. Never throws. */
export async function rememberNamespace(contextName: string, namespace: string): Promise<void> {
  try {
    const map = await readMap();
    const updated = [namespace, ...entriesOf(map, contextName).filter((n) => n !== namespace)].slice(
      0,
      MAX_RECENT_NAMESPACES
    );
    await LocalStorage.setItem(STORAGE_KEY, JSON.stringify({ ...map, [contextName]: updated }));
  } catch {
    // Recents are a convenience; ignore storage failures
  }
}
