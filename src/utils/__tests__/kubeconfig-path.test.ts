import { homedir } from "os";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { expandHome, resolveKubeconfigPath } from "../kubeconfig-path";

const HOME = "/home/tester";

describe("expandHome", () => {
  it("expands ~ and ~/ prefixes", () => {
    expect(expandHome("~", HOME)).toBe(HOME);
    expect(expandHome("~/.kube/x", HOME)).toBe(join(HOME, ".kube/x"));
  });

  it("leaves other paths alone", () => {
    expect(expandHome("/etc/kube", HOME)).toBe("/etc/kube");
    expect(expandHome("~other/x", HOME)).toBe("~other/x");
  });
});

describe("resolveKubeconfigPath", () => {
  it("prefers the explicit preference over KUBECONFIG", () => {
    expect(resolveKubeconfigPath("/pref/config", { KUBECONFIG: "/env/config" }, HOME)).toBe("/pref/config");
  });

  it("expands ~ in the preference", () => {
    expect(resolveKubeconfigPath("~/custom/config", {}, HOME)).toBe(join(HOME, "custom/config"));
  });

  it("uses the first non-empty entry of a colon-separated KUBECONFIG", () => {
    expect(resolveKubeconfigPath(undefined, { KUBECONFIG: ":/a/config:/b/config" }, HOME)).toBe("/a/config");
    expect(resolveKubeconfigPath(undefined, { KUBECONFIG: "/a/config:/b/config" }, HOME)).toBe("/a/config");
  });

  it("expands ~ in KUBECONFIG entries", () => {
    expect(resolveKubeconfigPath(undefined, { KUBECONFIG: "~/kc" }, HOME)).toBe(join(HOME, "kc"));
  });

  it("ignores empty or whitespace preferences", () => {
    expect(resolveKubeconfigPath("", { KUBECONFIG: "/env/config" }, HOME)).toBe("/env/config");
    expect(resolveKubeconfigPath("   ", { KUBECONFIG: "/env/config" }, HOME)).toBe("/env/config");
  });

  it("falls back to ~/.kube/config", () => {
    expect(resolveKubeconfigPath(undefined, {}, HOME)).toBe(join(HOME, ".kube", "config"));
    expect(resolveKubeconfigPath(undefined, { KUBECONFIG: " : " }, HOME)).toBe(join(HOME, ".kube", "config"));
  });

  it("uses the real home directory by default", () => {
    expect(resolveKubeconfigPath(undefined, {})).toBe(join(homedir(), ".kube", "config"));
  });
});
