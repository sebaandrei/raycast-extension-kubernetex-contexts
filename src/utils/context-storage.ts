import { readContextList, writeContextList, type ContextListKind } from "./recents";
import { entriesOf, MAX_RECENT_NAMESPACES, readRecentMap, writeRecentMap } from "./recent-namespaces";
import { getPreviousContext, setPreviousContext } from "./previous-context";

/** Replace `oldName` with `newName` in a list, keeping position; drops a duplicate of `newName`. */
function renameInList(list: string[], oldName: string, newName: string): string[] | undefined {
  if (!list.includes(oldName)) return undefined;
  const renamed = list.map((n) => (n === oldName ? newName : n));
  return [...new Set(renamed)];
}

async function migrateList(kind: ContextListKind, oldName: string, newName: string): Promise<void> {
  const result = await readContextList(kind);
  if (!result.ok) return;
  const updated = renameInList(result.value, oldName, newName);
  if (updated) await writeContextList(kind, updated, `rename ${oldName} -> ${newName}`);
}

async function migrateNamespaces(oldName: string, newName: string): Promise<void> {
  const result = await readRecentMap();
  if (!result.ok) return;
  const map = result.value;
  if (!Object.prototype.hasOwnProperty.call(map, oldName)) return;
  const moved = entriesOf(map, oldName);
  // Entries already stored under the new name stay, newer first; the old ones fill the rest
  const merged = [...new Set([...entriesOf(map, newName), ...moved])].slice(0, MAX_RECENT_NAMESPACES);
  const rest = Object.fromEntries(Object.entries(map).filter(([k]) => k !== oldName));
  await writeRecentMap({ ...rest, [newName]: merged }, `rename ${oldName} -> ${newName}`);
}

/**
 * Carry pins, recents, the previous context and recent namespaces over to a renamed context.
 * Best effort: never throws, and skips any item whose storage cannot be read.
 */
export async function migrateContextName(oldName: string, newName: string): Promise<void> {
  if (!oldName || !newName || oldName === newName) return;
  try {
    await migrateList("pinned", oldName, newName);
    await migrateList("recent", oldName, newName);
    await migrateNamespaces(oldName, newName);
    if ((await getPreviousContext()) === oldName) await setPreviousContext(newName);
  } catch (error) {
    console.error(`Failed to migrate stored data from "${oldName}" to "${newName}"`, error);
  }
}
