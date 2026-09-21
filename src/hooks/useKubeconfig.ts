import { useCallback, useMemo } from "react";
import { useCachedPromise } from "@raycast/utils";
import {
  KubeconfigState,
  loadKubeconfigState,
  setContextNamespace,
  switchToContext,
  switchToContextWithNamespace,
} from "../utils/kubeconfig-direct";

// useCachedPromise needs a promise-returning function
const loadState = async () => loadKubeconfigState();

type StateUpdate = (state: KubeconfigState) => KubeconfigState;

const withCurrentContext =
  (contextName: string, namespace?: string): StateUpdate =>
  (state) => ({
    ...state,
    currentContext: contextName,
    contexts: state.contexts.map((ctx) => ({
      ...ctx,
      current: ctx.name === contextName,
      ...(ctx.name === contextName && namespace ? { namespace } : {}),
    })),
  });

/**
 * Loads the kubeconfig once (a single read + parse) and exposes the derived data
 * together with the context operations. Operations throw typed errors on failure.
 */
export function useKubeconfig() {
  const { data, isLoading, error, revalidate, mutate } = useCachedPromise(loadState, [], {
    keepPreviousData: true,
    // Callers render the error themselves; avoid a duplicate default toast
    onError: () => undefined,
  });

  const run = useCallback(
    async (operation: () => void, optimisticUpdate?: StateUpdate) => {
      await mutate(
        Promise.resolve().then(operation),
        optimisticUpdate
          ? { optimisticUpdate: (current) => (current ? optimisticUpdate(current) : current) }
          : undefined
      );
      return true;
    },
    [mutate]
  );

  const switchContext = useCallback(
    (contextName: string) => run(() => switchToContext(contextName), withCurrentContext(contextName)),
    [run]
  );

  const switchContextWithNamespace = useCallback(
    (contextName: string, namespace?: string) =>
      run(() => switchToContextWithNamespace(contextName, namespace), withCurrentContext(contextName, namespace)),
    [run]
  );

  const setNamespace = useCallback(
    (contextName: string, namespace: string) => run(() => setContextNamespace(contextName, namespace)),
    [run]
  );

  const kubeconfigInfo = useMemo(
    () => ({
      path: data?.path ?? "",
      available: !!data,
      contextCount: data?.contexts.length ?? 0,
      currentContext: data?.currentContext ?? null,
    }),
    [data]
  );

  return {
    kubeconfigInfo,
    isKubeconfigAvailable: kubeconfigInfo.available,
    currentContext: data?.currentContext ?? null,
    contexts: useMemo(() => data?.contexts ?? [], [data]),
    namespaces: useMemo(() => data?.namespaces ?? [], [data]),
    clusters: useMemo(() => data?.clusters ?? [], [data]),
    users: useMemo(() => data?.users ?? [], [data]),
    isLoading,
    error,
    switchContext,
    switchContextWithNamespace,
    setNamespace,
    refresh: revalidate,
  };
}
