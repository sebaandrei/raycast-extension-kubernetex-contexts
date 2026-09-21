import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prefs = vi.hoisted(() => ({ kubeconfigPath: "" }));
vi.mock("../preferences", () => ({ getPreferences: () => ({ kubeconfigPath: prefs.kubeconfigPath }) }));

import {
  createContext,
  deleteContext,
  getAllAvailableNamespaces,
  getAllClusters,
  getAllContexts,
  getAllUsers,
  getClusterDetails,
  getCurrentContext,
  getUserAuthMethod,
  loadKubeconfigState,
  modifyContext,
  readKubeconfig,
  setContextNamespace,
  switchToContext,
  switchToContextWithNamespace,
} from "../kubeconfig-direct";
import * as kubeconfigIo from "../kubeconfig-io";
import { KubeconfigError, ValidationError } from "../kubeconfig-errors";

const SAMPLE = `# my clusters
apiVersion: v1
current-context: dev
contexts:
  - name: dev
    context: {cluster: dev-cluster, user: dev-user, namespace: apps}
  - name: dev-2
    context: {cluster: dev-cluster, user: dev-user}
  - name: prod
    context: {cluster: prod-cluster, user: prod-user}
clusters:
  - name: dev-cluster
    cluster:
      server: https://dev.example.com:6443
      certificate-authority-data: Zm9v
  - name: prod-cluster
    cluster:
      server: http://prod.example.com
      insecure-skip-tls-verify: true
users:
  - name: dev-user
    user:
      token: abc
  - name: prod-user
    user:
      exec:
        command: aws
`;

let dir: string;
let path: string;
let savedKubeconfig: string | undefined;

beforeEach(() => {
  savedKubeconfig = process.env.KUBECONFIG;
  delete process.env.KUBECONFIG;
  dir = mkdtempSync(join(tmpdir(), "kc-direct-"));
  path = join(dir, "config");
  prefs.kubeconfigPath = path;
  writeFileSync(path, SAMPLE);
});

afterEach(() => {
  if (savedKubeconfig === undefined) delete process.env.KUBECONFIG;
  else process.env.KUBECONFIG = savedKubeconfig;
  rmSync(dir, { recursive: true, force: true });
});

function expectError(fn: () => unknown, type: typeof ValidationError | typeof KubeconfigError, message: RegExp) {
  let error: unknown;
  try {
    fn();
  } catch (e) {
    error = e;
  }
  expect(error).toBeInstanceOf(type);
  expect((error as Error).message).toMatch(message);
  expect((error as ValidationError).action).toBeTruthy();
}

const cfg = () => readKubeconfig(path);
const file = () => readFileSync(path, "utf8");

describe("switching", () => {
  it("switches the current context and keeps comments", () => {
    switchToContext("prod");
    expect(getCurrentContext()).toBe("prod");
    expect(file()).toContain("# my clusters");
  });

  it("rejects an unknown context", () => {
    expectError(() => switchToContext("nope"), KubeconfigError, /not found/);
    expect(getCurrentContext()).toBe("dev");
  });

  it("sets a namespace on a context", () => {
    setContextNamespace("prod", "payments");
    expect(cfg().contexts?.find((c) => c.name === "prod")?.context.namespace).toBe("payments");
    expect(getCurrentContext()).toBe("dev");
  });

  it("rejects setting a namespace on an unknown context", () => {
    expectError(() => setContextNamespace("nope", "x"), KubeconfigError, /not found/);
  });

  it("switches with a namespace", () => {
    switchToContextWithNamespace("prod", "payments");
    const config = cfg();
    expect(config["current-context"]).toBe("prod");
    expect(config.contexts?.find((c) => c.name === "prod")?.context.namespace).toBe("payments");
  });

  it("switches without a namespace and leaves the existing one", () => {
    switchToContextWithNamespace("dev-2");
    const config = cfg();
    expect(config["current-context"]).toBe("dev-2");
    expect(config.contexts?.find((c) => c.name === "dev-2")?.context.namespace).toBeUndefined();
    switchToContextWithNamespace("dev");
    expect(cfg().contexts?.find((c) => c.name === "dev")?.context.namespace).toBe("apps");
  });

  it("rejects switching with a namespace to an unknown context", () => {
    expectError(() => switchToContextWithNamespace("nope", "x"), KubeconfigError, /not found/);
  });
});

describe("createContext", () => {
  it("creates a cluster with TLS verification on by default", () => {
    createContext("new", "new-cluster", "new-user", "ns", "https://new.example.com");
    const config = cfg();
    expect(config.contexts?.find((c) => c.name === "new")?.context).toEqual({
      cluster: "new-cluster",
      user: "new-user",
      namespace: "ns",
    });
    const cluster = config.clusters?.find((c) => c.name === "new-cluster");
    expect(cluster?.cluster.server).toBe("https://new.example.com");
    expect(cluster?.cluster).not.toHaveProperty("insecure-skip-tls-verify");
  });

  it("only skips TLS verification when opted in", () => {
    createContext("new", "new-cluster", "dev-user", undefined, "https://new.example.com", {
      insecureSkipTlsVerify: true,
    });
    expect(cfg().clusters?.find((c) => c.name === "new-cluster")?.cluster["insecure-skip-tls-verify"]).toBe(true);
  });

  it("requires a server URL for a new cluster", () => {
    expectError(() => createContext("new", "new-cluster", "dev-user"), ValidationError, /Server URL is required/);
    expectError(() => createContext("new", "new-cluster", "dev-user", "", "  "), ValidationError, /required/);
    expect(cfg().contexts).toHaveLength(3);
  });

  it("rejects an invalid URL or non-http protocol", () => {
    expectError(() => createContext("n", "c", "u", "", "not a url"), ValidationError, /not a valid URL/);
    expectError(() => createContext("n", "c", "u", "", "ftp://x.example.com"), ValidationError, /Unsupported protocol/);
    expectError(() => createContext("n", "c", "u", "", "file:///etc/passwd"), ValidationError, /Unsupported protocol/);
    expect(cfg().clusters).toHaveLength(2);
  });

  it("reuses an existing cluster without needing a server", () => {
    createContext("new", "dev-cluster", "dev-user");
    const config = cfg();
    expect(config.clusters).toHaveLength(2);
    expect(config.contexts?.find((c) => c.name === "new")?.context).toEqual({
      cluster: "dev-cluster",
      user: "dev-user",
    });
  });

  it("creates a missing user as an empty placeholder", () => {
    createContext("new", "dev-cluster", "brand-new-user");
    const user = cfg().users?.find((u) => u.name === "brand-new-user");
    expect(user).toEqual({ name: "brand-new-user", user: {} });
    expect(getUserAuthMethod("brand-new-user", cfg())).toBe("Unknown");
  });

  it("rejects a duplicate context name", () => {
    expectError(() => createContext("dev", "dev-cluster", "dev-user"), ValidationError, /already exists/);
    expect(cfg().contexts).toHaveLength(3);
  });

  it("rejects empty names", () => {
    expectError(() => createContext(" ", "c", "u", "", "https://x.example.com"), ValidationError, /required/);
    expectError(() => createContext("n", "", "u", "", "https://x.example.com"), ValidationError, /required/);
    expectError(() => createContext("n", "c", " ", "", "https://x.example.com"), ValidationError, /required/);
  });

  it("creates lists that are missing from the file", () => {
    writeFileSync(path, 'current-context: ""\n');
    createContext("first", "c", "u", undefined, "https://x.example.com");
    const config = cfg();
    expect(config.contexts?.map((c) => c.name)).toEqual(["first"]);
    expect(config.clusters?.map((c) => c.name)).toEqual(["c"]);
    expect(config.users?.map((u) => u.name)).toEqual(["u"]);
  });
});

describe("modifyContext", () => {
  it("rejects an unknown context", () => {
    expectError(() => modifyContext("nope", { namespace: "x" }), KubeconfigError, /not found/);
  });

  it("rejects an unknown cluster or user", () => {
    expectError(() => modifyContext("dev", { cluster: "ghost" }), ValidationError, /does not exist/);
    expectError(() => modifyContext("dev", { user: "ghost" }), ValidationError, /does not exist/);
    expect(cfg().contexts?.find((c) => c.name === "dev")?.context.cluster).toBe("dev-cluster");
  });

  it("changes cluster and user to existing ones", () => {
    modifyContext("dev", { cluster: "prod-cluster", user: "prod-user" });
    const ctx = cfg().contexts?.find((c) => c.name === "dev")?.context;
    expect(ctx?.cluster).toBe("prod-cluster");
    expect(ctx?.user).toBe("prod-user");
  });

  it("updates current-context when the current context is renamed", () => {
    modifyContext("dev", { newName: "dev-renamed" });
    const config = cfg();
    expect(config["current-context"]).toBe("dev-renamed");
    expect(config.contexts?.map((c) => c.name)).toEqual(["dev-renamed", "dev-2", "prod"]);
  });

  it("leaves current-context alone when another context is renamed", () => {
    modifyContext("prod", { newName: "prod-renamed" });
    expect(cfg()["current-context"]).toBe("dev");
  });

  it("rejects duplicate and empty new names", () => {
    expectError(() => modifyContext("dev", { newName: "prod" }), ValidationError, /already exists/);
    expectError(() => modifyContext("dev", { newName: "   " }), ValidationError, /cannot be empty/);
    expect(cfg().contexts?.map((c) => c.name)).toEqual(["dev", "dev-2", "prod"]);
  });

  it("removes the namespace with an empty string", () => {
    modifyContext("dev", { namespace: "" });
    expect(cfg().contexts?.find((c) => c.name === "dev")?.context).not.toHaveProperty("namespace");
    expect(file()).not.toContain("namespace: apps");
  });

  it("sets a namespace", () => {
    modifyContext("prod", { namespace: "payments" });
    expect(cfg().contexts?.find((c) => c.name === "prod")?.context.namespace).toBe("payments");
  });
});

describe("deleteContext", () => {
  it("refuses to delete the current context", () => {
    expectError(() => deleteContext("dev"), ValidationError, /Cannot delete the current context/);
    expect(cfg().contexts).toHaveLength(3);
  });

  it("rejects an unknown context", () => {
    expectError(() => deleteContext("nope"), KubeconfigError, /not found/);
  });

  it("keeps cluster and user by default", () => {
    expect(deleteContext("prod")).toEqual({});
    const config = cfg();
    expect(config.contexts?.map((c) => c.name)).toEqual(["dev", "dev-2"]);
    expect(config.clusters).toHaveLength(2);
    expect(config.users).toHaveLength(2);
  });

  it("removes an unreferenced cluster and user with removeUnused", () => {
    expect(deleteContext("prod", { removeUnused: true })).toEqual({
      removedCluster: "prod-cluster",
      removedUser: "prod-user",
    });
    const config = cfg();
    expect(config.clusters?.map((c) => c.name)).toEqual(["dev-cluster"]);
    expect(config.users?.map((u) => u.name)).toEqual(["dev-user"]);
  });

  it("keeps a cluster and user still used by another context", () => {
    expect(deleteContext("dev-2", { removeUnused: true })).toEqual({});
    const config = cfg();
    expect(config.contexts?.map((c) => c.name)).toEqual(["dev", "prod"]);
    expect(config.clusters?.map((c) => c.name)).toEqual(["dev-cluster", "prod-cluster"]);
    expect(config.users?.map((u) => u.name)).toEqual(["dev-user", "prod-user"]);
  });

  it("removes only the part that is unreferenced", () => {
    createContext("solo", "dev-cluster", "solo-user");
    expect(deleteContext("solo", { removeUnused: true })).toEqual({ removedUser: "solo-user" });
    expect(cfg().clusters?.map((c) => c.name)).toContain("dev-cluster");
  });
});

describe("read helpers", () => {
  it("getClusterDetails describes a cluster", () => {
    expect(getClusterDetails("dev-cluster", cfg())).toEqual({
      name: "dev-cluster",
      server: "https://dev.example.com:6443",
      isSecure: true,
      hasCA: true,
      protocol: "HTTPS",
      hostname: "dev.example.com",
      port: "6443",
    });
    expect(getClusterDetails("prod-cluster", cfg())).toMatchObject({
      isSecure: false,
      hasCA: false,
      protocol: "HTTP",
      port: "80",
    });
  });

  it("isSecure requires HTTPS and verified TLS", () => {
    const config = {
      clusters: [
        { name: "https", cluster: { server: "https://a.example" } },
        { name: "https-skip", cluster: { server: "https://a.example", "insecure-skip-tls-verify": true } },
        { name: "http", cluster: { server: "http://a.example" } },
        { name: "none", cluster: {} },
      ],
    } as unknown as ReturnType<typeof cfg>;
    expect(getClusterDetails("https", config)?.isSecure).toBe(true);
    expect(getClusterDetails("https-skip", config)?.isSecure).toBe(false);
    expect(getClusterDetails("http", config)?.isSecure).toBe(false);
    expect(getClusterDetails("none", config)).toMatchObject({ isSecure: false, protocol: "Unknown" });
  });

  it("getClusterDetails returns null for an unknown cluster", () => {
    expect(getClusterDetails("ghost", cfg())).toBeNull();
  });

  it("getUserAuthMethod detects methods", () => {
    expect(getUserAuthMethod("dev-user", cfg())).toBe("Token");
    expect(getUserAuthMethod("prod-user", cfg())).toBe("Exec (aws)");
    expect(getUserAuthMethod("ghost", cfg())).toBe("Unknown");
  });

  it("getUserAuthMethod detects tokenFile", () => {
    const config = { users: [{ name: "tf", user: { tokenFile: "/var/run/token" } }] } as unknown as ReturnType<
      typeof cfg
    >;
    expect(getUserAuthMethod("tf", config)).toBe("Token File");
  });

  it("getAllContexts sets cloudProvider from exec command or server host", () => {
    const config = {
      contexts: [
        { name: "a", context: { cluster: "c1", user: "u1" } },
        { name: "b", context: { cluster: "c2", user: "u2" } },
        { name: "c", context: { cluster: "c3", user: "u3" } },
      ],
      clusters: [
        { name: "c1", cluster: { server: "https://x.example.com" } },
        { name: "c2", cluster: { server: "https://x.hcp.westeurope.azmk8s.io:443" } },
        { name: "c3", cluster: { server: "https://y.example.com" } },
      ],
      users: [
        { name: "u1", user: { exec: { command: "/usr/bin/aws", args: ["eks", "get-token"] } } },
        { name: "u2", user: { token: "t" } },
        { name: "u3", user: { token: "t" } },
      ],
    } as unknown as ReturnType<typeof cfg>;
    expect(getAllContexts(config).map((c) => c.cloudProvider)).toEqual(["EKS", "AKS", undefined]);
  });

  it("getAllContexts flags the current context", () => {
    const contexts = getAllContexts();
    expect(contexts.map((c) => [c.name, c.current])).toEqual([
      ["dev", true],
      ["dev-2", false],
      ["prod", false],
    ]);
    expect(contexts[0].userAuthMethod).toBe("Token");
  });

  it("switching changes only current-context and leaves nothing behind", () => {
    switchToContext("prod");
    expect(file()).toBe(SAMPLE.replace("current-context: dev", "current-context: prod"));
    expect(readdirSync(dir)).toEqual(["config"]);
  });
});

describe("loadKubeconfigState", () => {
  it("returns contexts, current context, namespaces, clusters and users", () => {
    const state = loadKubeconfigState();

    expect(state.path).toBe(path);
    expect(state.currentContext).toBe("dev");
    expect(state.contexts).toEqual(getAllContexts());
    expect(state.namespaces).toEqual(getAllAvailableNamespaces());
    expect(state.clusters).toEqual(getAllClusters());
    expect(state.users).toEqual(getAllUsers());
    expect(state.namespaces).toContain("apps");
    expect(state.contexts.find((ctx) => ctx.name === "dev")?.current).toBe(true);
  });

  it("is plain serialisable data", () => {
    const state = loadKubeconfigState();
    // structuredClone throws on functions/class instances and keeps undefined fields
    expect(structuredClone(state)).toStrictEqual(state);
  });

  it("reads the kubeconfig file exactly once", () => {
    const spy = vi.spyOn(kubeconfigIo, "readKubeconfigFile");
    try {
      loadKubeconfigState();
      expect(spy).toHaveBeenCalledTimes(1);
    } finally {
      spy.mockRestore();
    }
  });

  it("throws the typed error when the file is missing", () => {
    prefs.kubeconfigPath = join(dir, "missing");
    expectError(() => loadKubeconfigState(), KubeconfigError, /./);
  });
});

describe("namespace validation", () => {
  const bad = "Bad_NS";
  const unchanged = () => readFileSync(path, "utf8");

  it("setContextNamespace rejects invalid names and leaves the file untouched", () => {
    const before = unchanged();
    expectError(() => setContextNamespace("dev", bad), ValidationError, /Invalid namespace/);
    expect(unchanged()).toBe(before);
  });

  it("switchToContextWithNamespace rejects invalid names but allows none", () => {
    const before = unchanged();
    expectError(() => switchToContextWithNamespace("prod", bad), ValidationError, /Invalid namespace/);
    expect(unchanged()).toBe(before);
    switchToContextWithNamespace("prod");
    expect(getCurrentContext()).toBe("prod");
  });

  it("createContext rejects an invalid namespace", () => {
    const before = unchanged();
    expectError(() => createContext("new", "dev-cluster", "dev-user", bad), ValidationError, /Invalid namespace/);
    expect(unchanged()).toBe(before);
  });

  it("modifyContext rejects invalid namespaces but empty still removes", () => {
    expectError(() => modifyContext("dev", { namespace: bad }), ValidationError, /Invalid namespace/);
    modifyContext("dev", { namespace: "" });
    expect(getAllContexts().find((c) => c.name === "dev")?.namespace).toBeUndefined();
    modifyContext("dev", { namespace: "valid-ns" });
    expect(getAllContexts().find((c) => c.name === "dev")?.namespace).toBe("valid-ns");
  });
});

describe("malformed kubeconfig entries", () => {
  const MALFORMED = `current-context: bare
contexts:
  - name: bare
  - name: ok
    context: {cluster: c-ok, user: u-ok, namespace: apps}
clusters:
  - name: c-bare
  - name: c-ok
    cluster: {server: "https://ok.example"}
users:
  - name: u-bare
  - name: u-ok
    user: {token: t}
`;

  beforeEach(() => writeFileSync(path, MALFORMED));

  it("lists a context without a context body with empty cluster and user", () => {
    const contexts = getAllContexts();
    expect(contexts.map((c) => [c.name, c.cluster, c.user, c.current])).toEqual([
      ["bare", "", "", true],
      ["ok", "c-ok", "u-ok", false],
    ]);
    expect(contexts[0].clusterDetails).toBeUndefined();
    expect(contexts[0].userAuthMethod).toBe("Unknown");
  });

  it("read helpers tolerate missing nested maps", () => {
    expect(getClusterDetails("c-bare", cfg())).toMatchObject({ server: "", isSecure: false, hasCA: false });
    expect(getUserAuthMethod("u-bare", cfg())).toBe("Unknown");
    expect(getAllClusters(cfg())).toEqual([
      { name: "c-bare", server: undefined },
      { name: "c-ok", server: "https://ok.example" },
    ]);
    expect(getAllUsers(cfg()).map((u) => u.name)).toEqual(["u-bare", "u-ok"]);
    expect(getAllAvailableNamespaces(cfg())).toContain("apps");
    expect(loadKubeconfigState().contexts).toHaveLength(2);
  });

  it("reading does not add nested maps to the file", () => {
    switchToContext("ok");
    expect(file()).toContain("  - name: bare\n");
    expect(file()).not.toMatch(/name: bare\n\s+context/);
  });

  it("creates the nested map only when a value is set", () => {
    setContextNamespace("bare", "team");
    expect(cfg().contexts?.[0]).toEqual({ name: "bare", context: { cluster: "", user: "", namespace: "team" } });
  });

  it("switchToContextWithNamespace and modifyContext work on a bare context", () => {
    switchToContextWithNamespace("bare", "n1");
    expect(cfg().contexts?.[0].context?.namespace).toBe("n1");
    modifyContext("bare", { cluster: "c-ok", user: "u-ok" });
    expect(cfg().contexts?.[0].context).toMatchObject({ cluster: "c-ok", user: "u-ok" });
  });

  it("deletes a bare context, including with removeUnused", () => {
    switchToContext("ok");
    expect(deleteContext("bare", { removeUnused: true })).toEqual({});
    expect(cfg().contexts?.map((c) => c.name)).toEqual(["ok"]);
  });

  it("clearing the namespace of a bare context is a no-op", () => {
    modifyContext("bare", { namespace: "" });
    expect(cfg().contexts?.[0]).toEqual({ name: "bare" });
  });
});
