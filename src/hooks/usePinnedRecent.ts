import { useCallback, useRef } from "react";
import { showToast, Toast } from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { getPinnedContexts, getRecentContexts, MAX_PINNED_CONTEXTS, togglePin } from "../utils/recents";

const load = async () => ({ pinned: await getPinnedContexts(), recent: await getRecentContexts() });

/**
 * Pinned and recent context names, plus a `toggle` that flips a pin, shows a toast and refreshes.
 * Pass the names of all existing contexts so stale pins do not count towards the limit.
 */
export function usePinnedRecent() {
  const { data, revalidate } = useCachedPromise(load, [], {
    onError: (err) => console.error("Failed to load pinned and recent contexts:", err),
  });
  const busy = useRef(false);

  const toggle = useCallback(
    async (name: string, existing?: string[]) => {
      if (busy.current) return;
      busy.current = true;
      try {
        const result = await togglePin(name, existing);
        await revalidate();
        if (!result.ok) {
          await showToast({
            style: Toast.Style.Failure,
            title: result.reason === "limit" ? `Pin limit reached (${MAX_PINNED_CONTEXTS})` : "Could not save pin",
          });
          return;
        }
        await showToast({ style: Toast.Style.Success, title: result.pinned ? `Pinned ${name}` : `Unpinned ${name}` });
      } finally {
        busy.current = false;
      }
    },
    [revalidate]
  );

  return { pinned: data?.pinned ?? [], recent: data?.recent ?? [], toggle };
}
