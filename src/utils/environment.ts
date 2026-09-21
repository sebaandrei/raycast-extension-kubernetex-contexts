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

export interface ProductionMatcher {
  isProduction: (contextName: string) => boolean;
  /** `false` when the preference is not a valid regex and the default is in use. */
  valid: boolean;
}

/** Builds a matcher from the current preference. Reads preferences but has no other side effects. */
export function getProductionMatcher(): ProductionMatcher {
  const { regex, valid } = compileProductionPattern(getPreferences().productionPattern);
  return { isProduction: (contextName) => regex !== null && regex.test(contextName), valid };
}

let invalidPatternReported = false;

/** Tell the user once per process that the pattern is invalid. Call from an effect or event handler, not render. */
export function reportInvalidPatternOnce(): void {
  if (invalidPatternReported) return;
  invalidPatternReported = true;
  showToast({
    style: Toast.Style.Failure,
    title: "Invalid production pattern",
    message: `Using the default pattern "${DEFAULT_PRODUCTION_PATTERN}" instead. Fix it in the extension preferences.`,
  }).catch((err) => console.error("Failed to show invalid pattern toast:", err));
}
