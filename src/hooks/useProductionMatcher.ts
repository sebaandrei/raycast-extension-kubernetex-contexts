import { useEffect, useMemo } from "react";
import { getProductionMatcher, reportInvalidPatternOnce } from "../utils/environment";

/** Production matcher for list views; reports an invalid preference from an effect, not during render. */
export function useProductionMatcher(): (contextName: string) => boolean {
  const matcher = useMemo(() => getProductionMatcher(), []);

  useEffect(() => {
    if (!matcher.valid) reportInvalidPatternOnce();
  }, [matcher]);

  return matcher.isProduction;
}
