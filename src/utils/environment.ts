import { showToast, Toast } from "@raycast/api";
import { getPreferences } from "./preferences";

export const DEFAULT_PRODUCTION_PATTERN = "prod|prd|live";

export interface CompiledPattern {
  /** `null` when detection is disabled (empty pattern). */
  regex: RegExp | null;
  /** `false` when the given pattern was not a valid regex and the default was used instead. */
  valid: boolean;
}

/** Pure: turn the preference value into a case-insensitive regex. */
export function compileProductionPattern(pattern: string | undefined): CompiledPattern {
  const source = typeof pattern === "string" ? pattern : DEFAULT_PRODUCTION_PATTERN;
  if (source.trim() === "") return { regex: null, valid: true };
  try {
    return { regex: new RegExp(source, "i"), valid: true };
  } catch {
    return { regex: new RegExp(DEFAULT_PRODUCTION_PATTERN, "i"), valid: false };
  }
}

/** Pure: does the context NAME match the pattern (substring semantics; anchor with ^ / $). */
export function isProduction(contextName: string, pattern?: string): boolean {
  const { regex } = compileProductionPattern(pattern);
  return regex !== null && regex.test(contextName);
}

let invalidPatternReported = false;

/** Reads the preference and returns a matcher. Reports an invalid pattern once per command run. */
export function getProductionMatcher(): (contextName: string) => boolean {
  const { regex, valid } = compileProductionPattern(getPreferences().productionPattern);
  if (!valid && !invalidPatternReported) {
    invalidPatternReported = true;
    showToast({
      style: Toast.Style.Failure,
      title: "Invalid production pattern",
      message: `Using the default pattern "${DEFAULT_PRODUCTION_PATTERN}" instead. Fix it in the extension preferences.`,
    }).catch((err) => console.error("Failed to show invalid pattern toast:", err));
  }
  return (contextName) => regex !== null && regex.test(contextName);
}
