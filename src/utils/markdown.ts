/** Escapes Markdown-sensitive characters so interpolated values render literally. */
export function escapeMarkdown(value: string): string {
  return value.replace(/[\\`*_{}[\]()<>#+\-.!|~]/g, "\\$&").replace(/\r?\n/g, " ");
}
