/** Menu bar title: the context name, truncated with an ellipsis, or a neutral label when there is none. */
export function formatMenuBarTitle(contextName: string | null | undefined, max = 24): string {
  if (!contextName) return "No context";
  const chars = Array.from(contextName);
  if (chars.length <= max) return contextName;
  return chars.slice(0, Math.max(max - 1, 0)).join("") + "…";
}
