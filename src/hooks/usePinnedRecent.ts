import { useCallback } from "react";
import { showToast, Toast } from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { getPinnedContexts, getRecentContexts, MAX_PINNED_CONTEXTS, togglePin } from "../utils/recents";

const load = async () => ({ pinned: await getPinnedContexts(), recent: await getRecentContexts() });

/** Pinned and recent context names, plus a `toggle` that flips a pin, shows a toast and refreshes. */
export function usePinnedRecent() {
  const { data, revalidate } = useCachedPromise(load, [], { onError: () => undefined });

  const toggle = useCallback(
    async (name: string) => {
      if (!data?.pinned.includes(name) && (data?.pinned.length ?? 0) >= MAX_PINNED_CONTEXTS) {
        await showToast({ style: Toast.Style.Failure, title: `Pin limit reached (${MAX_PINNED_CONTEXTS})` });
        return;
      }
      const pinnedNow = await togglePin(name);
      await revalidate();
      await showToast({ style: Toast.Style.Success, title: pinnedNow ? `Pinned ${name}` : `Unpinned ${name}` });
    },
    [data, revalidate]
  );

  return { pinned: data?.pinned ?? [], recent: data?.recent ?? [], toggle };
}
