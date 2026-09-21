import { describe, expect, it } from "vitest";
import { buildKubectlCommand, shellQuote } from "../kubectl-command";

describe("shellQuote", () => {
  it("leaves safe values alone", () => {
    expect(shellQuote("arn:aws:eks:eu-west-1:123:cluster/dev")).toBe("arn:aws:eks:eu-west-1:123:cluster/dev");
    expect(shellQuote("gke_proj_zone_name")).toBe("gke_proj_zone_name");
  });
  it("quotes spaces and metacharacters", () => {
    expect(shellQuote("my ctx")).toBe("'my ctx'");
    expect(shellQuote("a;rm -rf /")).toBe("'a;rm -rf /'");
    expect(shellQuote("$(id)")).toBe("'$(id)'");
    expect(shellQuote("`x`")).toBe("'`x`'");
  });
  it("escapes single quotes", () => {
    expect(shellQuote("it's")).toBe(`'it'\\''s'`);
  });
  it("quotes the empty string", () => {
    expect(shellQuote("")).toBe("''");
  });
});

describe("buildKubectlCommand", () => {
  it("omits -n without a namespace", () => {
    expect(buildKubectlCommand("dev")).toBe("kubectl --context dev");
    expect(buildKubectlCommand("dev", "")).toBe("kubectl --context dev");
  });
  it("adds the namespace", () => {
    expect(buildKubectlCommand("dev", "apps")).toBe("kubectl --context dev -n apps");
  });
  it("quotes unsafe values", () => {
    expect(buildKubectlCommand("my ctx", "a b")).toBe("kubectl --context 'my ctx' -n 'a b'");
  });
});
