import { KubernetesContext } from "../types";

export interface ContextSections {
  pinned: KubernetesContext[];
  recent: KubernetesContext[];
  all: KubernetesContext[];
}

/** Resolve names to contexts, in name order; unknown and duplicate names are dropped. */
function resolve(names: string[], byName: Map<string, KubernetesContext>, used: Set<string>): KubernetesContext[] {
  const result: KubernetesContext[] = [];
  for (const name of names) {
    const context = byName.get(name);
    if (!context || used.has(name)) continue;
    used.add(name);
    result.push(context);
  }
  return result;
}

/**
 * Split contexts into Pinned (pin order), Recent (recency order, minus pinned) and All (the rest,
 * current context first). No context appears twice; names that no longer exist are dropped.
 */
export function buildSections(input: {
  contexts: KubernetesContext[];
  pinned: string[];
  recent: string[];
}): ContextSections {
  const byName = new Map<string, KubernetesContext>();
  for (const context of input.contexts) if (!byName.has(context.name)) byName.set(context.name, context);

  const used = new Set<string>();
  const pinned = resolve(input.pinned, byName, used);
  const recent = resolve(input.recent, byName, used);
  const rest = [...byName.values()].filter((c) => !used.has(c.name));
  const all = [...rest].sort((a, b) => Number(!!b.current) - Number(!!a.current));
  return { pinned, recent, all };
}
