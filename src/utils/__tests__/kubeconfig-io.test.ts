import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "fs";
import { tmpdir } from "os";
import { dirname, join } from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KubeconfigError } from "../kubeconfig-errors";
import { KubeConfig, readKubeconfigFile, writeKubeconfigFile } from "../kubeconfig-io";

const SAMPLE = `# top comment
apiVersion: v1
current-context: a
contexts:
  # ctx a comment
  - name: a
    context: {cluster: ca, user: ua}   # inline
  - name: b
    context:
      cluster: cb
      user: ub
clusters:
  - name: ca
    cluster:
      server: https://a.example:6443 # server a
  - name: cb
    cluster:
      server: https://b.example
users:
  - name: ua
    user: {token: secret}
  - name: ub
    user:
      exec:
        command: aws
        args: [eks, get-token]
`;

let dir: string;
let path: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "kc-io-"));
  path = join(dir, "config");
});

afterEach(() => {
  vi.restoreAllMocks();
  rmSync(dir, { recursive: true, force: true });
});

function seed(content = SAMPLE): void {
  writeFileSync(path, content);
}

describe("readKubeconfigFile", () => {
  it("reads a valid file", () => {
    seed();
    const config = readKubeconfigFile(path);
    expect(config["current-context"]).toBe("a");
    expect(config.contexts?.map((c) => c.name)).toEqual(["a", "b"]);
    expect(config.users?.[1].user.exec).toEqual({ command: "aws", args: ["eks", "get-token"] });
  });

  it("rejects an empty file", () => {
    writeFileSync(path, "  \n");
    expect(() => readKubeconfigFile(path)).toThrow(/empty/);
    expect(() => readKubeconfigFile(path)).toThrow(KubeconfigError);
  });

  it("rejects invalid YAML", () => {
    writeFileSync(path, "a: [unclosed\n");
    expect(() => readKubeconfigFile(path)).toThrow(/Invalid YAML/);
  });

  it("rejects non-mapping documents", () => {
    writeFileSync(path, "- a\n- b\n");
    expect(() => readKubeconfigFile(path)).toThrow(/Invalid kubeconfig format/);
  });

  it.each([
    ["contexts", "contexts: {a: 1}\n"],
    ["clusters", "clusters: nope\n"],
    ["users", "users: 5\n"],
  ])("rejects %s that is not a list", (key, content) => {
    writeFileSync(path, content);
    let error: unknown;
    try {
      readKubeconfigFile(path);
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(KubeconfigError);
    expect((error as KubeconfigError).message).toBe(`Invalid kubeconfig: "${key}" must be a list`);
    expect((error as KubeconfigError).action).toBeTruthy();
  });

  it.each([
    ["a scalar entry", "contexts:\n  - just-a-string\n"],
    ["an entry without a name", "clusters:\n  - cluster: {server: https://x}\n"],
    ["an entry with a non-string name", "users:\n  - name: 7\n"],
  ])("rejects %s", (_label, content) => {
    writeFileSync(path, content);
    expect(() => readKubeconfigFile(path)).toThrow(KubeconfigError);
    expect(() => readKubeconfigFile(path)).toThrow(/Invalid kubeconfig: entry 1 of/);
  });

  it.each(["contexts", "clusters", "users"])("accepts `%s: null` (kubectl writes it for empty sections)", (key) => {
    writeFileSync(path, `current-context: ""\n${key}: null\n`);
    const config = readKubeconfigFile(path);
    expect(config[key as "contexts" | "clusters" | "users"]).toBeNull();
    writeKubeconfigFile(config, path);
    expect(readFileSync(path, "utf8")).toBe(`current-context: ""\n${key}: null\n`);
  });

  it("validates before writing: an invalid config never reaches the disk", () => {
    writeFileSync(path, "contexts:\n  - name: a\n");
    const before = readFileSync(path, "utf8");
    const config = readKubeconfigFile(path);
    (config as { contexts: unknown }).contexts = "not a list";
    expect(() => writeKubeconfigFile(config, path)).toThrow(/must be a list/);
    expect(readFileSync(path, "utf8")).toBe(before);
    expect(readdirSync(dirname(path)).filter((f) => f.endsWith(".tmp") || f.endsWith(".lock"))).toEqual([]);
  });

  it("accepts entries without their nested map and does not add keys", () => {
    writeFileSync(path, "contexts:\n  - name: bare\n");
    const config = readKubeconfigFile(path);
    expect(config).toStrictEqual({ contexts: [{ name: "bare" }] });
    writeKubeconfigFile(config, path);
    expect(readFileSync(path, "utf8")).toBe("contexts:\n  - name: bare\n");
  });

  it("reports a missing file with an action", () => {
    let error: unknown;
    try {
      readKubeconfigFile(join(dir, "nope"));
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(KubeconfigError);
    expect((error as KubeconfigError).message).toMatch(/not found/);
    expect((error as KubeconfigError).action).toBeTruthy();
  });
});

describe("writeKubeconfigFile", () => {
  it("preserves comments and compact flow style after an edit", () => {
    seed();
    const config = readKubeconfigFile(path);
    config["current-context"] = "b";
    writeKubeconfigFile(config, path);

    const out = readFileSync(path, "utf8");
    expect(out).toContain("# top comment");
    expect(out).toContain("# ctx a comment");
    expect(out).toContain("# inline");
    expect(out).toContain("# server a");
    expect(out).toContain("current-context: b");
    expect(out).toContain("{cluster: ca, user: ua}");
    expect(out).toContain("args: [eks, get-token]");
  });

  it("keeps unrelated comments when list items are added, removed and renamed", () => {
    seed();
    const config = readKubeconfigFile(path);
    config.contexts!.splice(0, 1);
    config.contexts!.push({ name: "c", context: { cluster: "cb", user: "ub", namespace: "kube-system" } });
    config.contexts![0].name = "b-renamed";
    writeKubeconfigFile(config, path);

    const out = readFileSync(path, "utf8");
    expect(out).toContain("# top comment");
    expect(out).toContain("# server a");
    expect(out).toContain("namespace: kube-system");

    const reread = readKubeconfigFile(path);
    expect(reread.contexts?.map((c) => c.name)).toEqual(["b-renamed", "c"]);
    expect(reread.users?.[1].user.exec).toEqual({ command: "aws", args: ["eks", "get-token"] });
  });

  it("keeps items that share a name", () => {
    seed(
      "contexts:\n  - name: x\n    context: {cluster: c1, user: u}\n  - name: x\n    context: {cluster: c2, user: u}\n"
    );
    const config = readKubeconfigFile(path);
    config.contexts![0].context.namespace = "n1";
    writeKubeconfigFile(config, path);

    const reread = readKubeconfigFile(path);
    expect(reread.contexts).toHaveLength(2);
    expect(reread.contexts!.map((c) => c.context.cluster)).toEqual(["c1", "c2"]);
    expect(reread.contexts![0].context.namespace).toBe("n1");
    expect(reread.contexts![1].context.namespace).toBeUndefined();
  });

  it("keeps the mode of an existing file", () => {
    seed();
    chmodSync(path, 0o640);
    const config = readKubeconfigFile(path);
    config["current-context"] = "b";
    writeKubeconfigFile(config, path);
    expect(statSync(path).mode & 0o777).toBe(0o640);
  });

  it("creates new files with mode 0600", () => {
    const newPath = join(dir, "new");
    writeKubeconfigFile({ "current-context": "x", contexts: [] }, newPath);
    expect(statSync(newPath).mode & 0o777).toBe(0o600);
    expect(readFileSync(newPath, "utf8")).toContain("current-context: x");
  });

  it("leaves no temp or lock files behind", () => {
    seed();
    const config = readKubeconfigFile(path);
    config["current-context"] = "b";
    writeKubeconfigFile(config, path);
    expect(readdirSync(dir)).toEqual(["config"]);
  });

  it("supports repeated writes from the same config object", () => {
    seed();
    const config = readKubeconfigFile(path);
    config["current-context"] = "b";
    writeKubeconfigFile(config, path);
    config["current-context"] = "a";
    writeKubeconfigFile(config, path);
    expect(readKubeconfigFile(path)["current-context"]).toBe("a");
  });

  it("keeps a symlink and updates the real file", () => {
    seed();
    const link = join(dir, "link");
    symlinkSync(path, link);

    const config = readKubeconfigFile(link);
    config["current-context"] = "b";
    writeKubeconfigFile(config, link);

    expect(lstatSync(link).isSymbolicLink()).toBe(true);
    expect(readFileSync(path, "utf8")).toContain("current-context: b");
  });

  it("refuses a dangling symlink", () => {
    const link = join(dir, "dangling");
    symlinkSync(join(dir, "missing-target"), link);

    expect(() => writeKubeconfigFile({ contexts: [] }, link)).toThrow(/symlink to a file that does not exist/);
    expect(lstatSync(link).isSymbolicLink()).toBe(true);
    expect(existsSync(join(dir, "missing-target"))).toBe(false);
  });

  it("refuses to overwrite a concurrent external modification", () => {
    seed();
    const config = readKubeconfigFile(path);
    config["current-context"] = "b";
    writeFileSync(path, `${readFileSync(path, "utf8")}# external\n`);

    expect(() => writeKubeconfigFile(config, path)).toThrow(/changed on disk/);
    const after = readFileSync(path, "utf8");
    expect(after.endsWith("# external\n")).toBe(true);
    expect(after).toContain("current-context: a");
    expect(readdirSync(dir)).toEqual(["config"]);
  });

  it("is blocked by an existing lock file, without deleting it", () => {
    seed();
    const lock = `${path}.lock`;
    writeFileSync(lock, "");
    const config = readKubeconfigFile(path);
    config["current-context"] = "b";

    let error: unknown;
    try {
      writeKubeconfigFile(config, path);
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(KubeconfigError);
    expect((error as KubeconfigError).message).toMatch(/locked by another process/);
    expect((error as KubeconfigError).action).toBeTruthy();
    expect(existsSync(lock)).toBe(true);
    expect(readFileSync(path, "utf8")).toBe(SAMPLE);

    // Once the lock is gone the same write succeeds and releases its own lock
    unlinkSync(lock);
    writeKubeconfigFile(config, path);
    expect(existsSync(lock)).toBe(false);
    expect(readFileSync(path, "utf8")).toContain("current-context: b");
  });

  it("does not corrupt the file when the write fails", () => {
    seed();
    const config = readKubeconfigFile(path);
    config["current-context"] = "b";
    // A circular structure makes serialisation fail before anything reaches the disk
    vi.spyOn(console, "error").mockImplementation(() => {});
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    (config as Record<string, unknown>).broken = circular;

    expect(() => writeKubeconfigFile(config, path)).toThrow();
    expect(readFileSync(path, "utf8")).toBe(SAMPLE);
    expect(readdirSync(dir)).toEqual(["config"]);
  });

  it("throws when the write target differs from the path that was read", () => {
    seed();
    const other = join(dir, "other");
    writeFileSync(other, "current-context: z\n");
    const config = readKubeconfigFile(path);
    config["current-context"] = "b";

    let error: unknown;
    try {
      writeKubeconfigFile(config, other);
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(KubeconfigError);
    expect((error as KubeconfigError).message).toBe("Kubeconfig path changed while editing");
    expect((error as KubeconfigError).action).toBe("Retry the action");
    expect(readFileSync(other, "utf8")).toBe("current-context: z\n");
    expect(readFileSync(path, "utf8")).toBe(SAMPLE);
  });

  it("does not recreate a file that was deleted after it was read", () => {
    seed();
    const config = readKubeconfigFile(path);
    config["current-context"] = "b";
    unlinkSync(path);

    expect(() => writeKubeconfigFile(config, path)).toThrow(/changed on disk/);
    expect(existsSync(path)).toBe(false);
    expect(readdirSync(dir)).toEqual([]);
  });

  it("still writes a config that was never read from disk, without comments", () => {
    seed();
    const config: KubeConfig = { "current-context": "fresh", contexts: [] };
    writeKubeconfigFile(config, path);
    const out = readFileSync(path, "utf8");
    // Documented limitation: no source document, so the old comments are gone
    expect(out).not.toContain("# top comment");
    expect(readKubeconfigFile(path)).toStrictEqual(config);
  });

  it("round-trips scalar type changes, removed keys, reordering and unnamed sequences", () => {
    seed(
      [
        "# c",
        "current-context: a",
        "extra: {n: 1, flag: true, list: [x, y, z], drop: me}",
        "contexts:",
        "  - name: a",
        "    context: {cluster: ca, user: ua}",
        "  - name: b",
        "    context: {cluster: cb, user: ub}",
        "",
      ].join("\n")
    );
    const config = readKubeconfigFile(path) as KubeConfig & { extra: Record<string, unknown> };
    // scalar type change, key set to undefined, sequence reorder and removal of unnamed items
    config.extra.n = "one";
    config.extra.flag = 0;
    config.extra.drop = undefined;
    config.extra.list = ["z", "x"];
    config.contexts!.reverse();

    writeKubeconfigFile(config, path);
    const reread = readKubeconfigFile(path);
    expect(reread).toStrictEqual(JSON.parse(JSON.stringify(config)));
    expect(reread.contexts!.map((c) => c.name)).toEqual(["b", "a"]);
    expect((reread as typeof config).extra).toStrictEqual({ n: "one", flag: 0, list: ["z", "x"] });
  });

  // Behaviour pinned as-is: a multi-document file is read as its first document
  // (with the yaml library's "multiple documents" error surfacing as invalid YAML).
  it("rejects a multi-document YAML file", () => {
    writeFileSync(path, "current-context: a\n---\ncurrent-context: b\n");
    expect(() => readKubeconfigFile(path)).toThrow(/Invalid YAML/);
  });

  it("does not report a failed stat after a successful rename as a write failure", () => {
    seed();
    const config = readKubeconfigFile(path);
    config["current-context"] = "b";
    writeKubeconfigFile(config, path);
    // The remembered source is refreshed, so a second write does not see a conflict
    config["current-context"] = "a";
    expect(() => writeKubeconfigFile(config, path)).not.toThrow();
  });

  describe.skipIf(process.getuid?.() === 0)("permissions", () => {
    afterEach(() => {
      try {
        chmodSync(path, 0o600);
      } catch {
        // file may not exist
      }
      chmodSync(dir, 0o700);
    });

    it("reports a permission error when reading an unreadable file", () => {
      seed();
      chmodSync(path, 0o000);
      expect(() => readKubeconfigFile(path)).toThrow(/Permission denied accessing/);
    });

    it("names the directory when it cannot write next to the kubeconfig", () => {
      seed();
      const config = readKubeconfigFile(path);
      config["current-context"] = "b";
      chmodSync(dir, 0o500);

      let error: unknown;
      try {
        writeKubeconfigFile(config, path);
      } catch (e) {
        error = e;
      }
      expect(error).toBeInstanceOf(KubeconfigError);
      expect((error as KubeconfigError).message).toContain(`Permission denied writing in ${realpathSync(dir)}`);
      expect((error as KubeconfigError).action).not.toContain("chmod 600");
      chmodSync(dir, 0o700);
      expect(readFileSync(path, "utf8")).toBe(SAMPLE);
    });
  });

  it("rejects non-object config", () => {
    expect(() => writeKubeconfigFile(null as never, path)).toThrow(/Invalid kubeconfig data/);
  });
});
