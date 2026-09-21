/** Quote a value for a POSIX shell only when it contains characters that need it. */
export function shellQuote(value: string): string {
  if (value === "") return "''";
  if (/^[A-Za-z0-9_@%+=:,./-]+$/.test(value)) return value;
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

/** `kubectl --context <name>` plus ` -n <namespace>` when a namespace is set. */
export function buildKubectlCommand(contextName: string, namespace?: string): string {
  const base = `kubectl --context ${shellQuote(contextName)}`;
  return namespace ? `${base} -n ${shellQuote(namespace)}` : base;
}
