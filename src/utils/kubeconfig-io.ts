import {
  closeSync,
  fchmodSync,
  fsyncSync,
  lstatSync,
  openSync,
  readFileSync,
  realpathSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "fs";
import { basename, dirname, join } from "path";
import { Document, isMap, isScalar, isSeq, parseDocument, YAMLMap, YAMLSeq } from "yaml";
import { KubeconfigError, ValidationError } from "./kubeconfig-errors";

export interface KubeConfig {
  "current-context"?: string;
  contexts?: Array<{
    name: string;
    context: {
      cluster: string;
      user: string;
      namespace?: string;
    };
  }>;
  clusters?: Array<{
    name: string;
    cluster: {
      server?: string;
      "certificate-authority"?: string;
      "certificate-authority-data"?: string;
      "insecure-skip-tls-verify"?: boolean;
      [key: string]: unknown;
    };
  }>;
  users?: Array<{
    name: string;
    user: {
      "client-certificate"?: string;
      "client-certificate-data"?: string;
      "client-key"?: string;
      "client-key-data"?: string;
      token?: string;
      username?: string;
      password?: string;
      "auth-provider"?: Record<string, unknown>;
      exec?: Record<string, unknown>;
      [key: string]: unknown;
    };
  }>;
}

/**
 * What was read from disk for a config object. Kept so a later write can
 * update the original YAML document (preserving comments and formatting)
 * and detect edits made by other tools in between.
 */
interface Source {
  doc: Document;
  path: string;
  mtimeMs: number;
  size: number;
}

const sources = new WeakMap<object, Source>();

const NEW_FILE_MODE = 0o600;

function errorCode(error: unknown): string | undefined {
  return error instanceof Error ? (error as NodeJS.ErrnoException).code : undefined;
}

function toFileError(error: unknown, path: string, action: "read" | "write"): KubeconfigError {
  switch (errorCode(error)) {
    case "ENOENT":
      return new KubeconfigError(
        `Kubeconfig file not found at ${path}`,
        "Create a kubeconfig file, set the Kubeconfig Path in the extension preferences, or set the KUBECONFIG environment variable"
      );
    case "EACCES":
    case "EPERM":
      return new KubeconfigError(
        `Permission denied ${action === "read" ? "accessing" : "writing"} ${path}`,
        `Fix file permissions: chmod 600 ${path}`
      );
    case "ENOSPC":
      return new KubeconfigError("No space left on device", "Free up disk space and try again");
    default:
      console.error(`Failed to ${action} kubeconfig:`, error);
      return new KubeconfigError(
        `Failed to ${action} kubeconfig file`,
        action === "read" ? "Check the file exists and is accessible" : "Check file permissions and disk space"
      );
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Read and parse a kubeconfig file
 */
export function readKubeconfigFile(kubeconfigPath: string): KubeConfig {
  let realPath: string;
  let content: string;
  let stat: ReturnType<typeof statSync>;

  try {
    // Follow symlinks so later writes update the real file, not the link
    realPath = realpathSync(kubeconfigPath);
    // Stat before reading: if the file changes in between, the write-time check fails safe
    stat = statSync(realPath);
    content = readFileSync(realPath, "utf8");
  } catch (error) {
    throw toFileError(error, kubeconfigPath, "read");
  }

  if (!content.trim()) {
    throw new KubeconfigError("Kubeconfig file is empty", "Add cluster configuration to your kubeconfig file");
  }

  const doc = parseDocument(content);
  if (doc.errors.length > 0) {
    throw new KubeconfigError("Invalid YAML syntax in kubeconfig", doc.errors[0].message);
  }

  const config = doc.toJS();
  if (!isPlainObject(config)) {
    throw new KubeconfigError("Invalid kubeconfig format", "Check your kubeconfig syntax and structure");
  }

  sources.set(config, { doc, path: realPath, mtimeMs: stat.mtimeMs, size: stat.size });
  return config as KubeConfig;
}

/**
 * Update a YAML node so it represents `value`, reusing existing nodes where
 * possible so comments and formatting survive. List items that have a `name`
 * are matched by name, other list items by position.
 */
function syncNode(existing: unknown, value: unknown, doc: Document): unknown {
  if (isPlainObject(value)) {
    const map = isMap(existing) ? existing : (doc.createNode({}) as YAMLMap);

    for (const pair of [...map.items]) {
      const key = String(isScalar(pair.key) ? pair.key.value : pair.key);
      if (!(key in value) || value[key] === undefined) {
        map.delete(key);
      }
    }

    for (const [key, child] of Object.entries(value)) {
      if (child !== undefined) {
        map.set(key, syncNode(map.get(key, true), child, doc));
      }
    }
    return map;
  }

  if (Array.isArray(value)) {
    const seq = isSeq(existing) ? existing : (doc.createNode([]) as YAMLSeq);
    const previous = [...seq.items];

    const byName = new Map<string, unknown[]>();
    for (const item of previous) {
      const name = isMap(item) ? item.get("name") : undefined;
      if (typeof name === "string") byName.set(name, [...(byName.get(name) ?? []), item]);
    }

    seq.items = value.map((item, index) => {
      const name = isPlainObject(item) && typeof item.name === "string" ? item.name : undefined;
      // Duplicate names are matched in order, each node used at most once
      const match = name !== undefined ? byName.get(name)?.shift() : previous[index];
      return syncNode(match, item, doc);
    });
    return seq;
  }

  if (isScalar(existing)) {
    if (existing.value === value) return existing;
    if (value !== null && typeof existing.value === typeof value) {
      existing.value = value;
      return existing;
    }
  }
  return doc.createNode(value);
}

function unlinkQuietly(path: string): void {
  try {
    unlinkSync(path);
  } catch {
    // Nothing to clean up
  }
}

/**
 * Write via temp file and rename so readers never see a partial file
 */
function atomicWrite(target: string, content: string, mode: number): void {
  const tempPath = join(dirname(target), `.${basename(target)}.${process.pid}.${Date.now()}.tmp`);
  const fd = openSync(tempPath, "wx", mode);

  try {
    fchmodSync(fd, mode);
    // writeFileSync on a descriptor loops until every byte is written
    writeFileSync(fd, content, "utf8");
    fsyncSync(fd);
  } catch (error) {
    closeSync(fd);
    unlinkQuietly(tempPath);
    throw error;
  }
  closeSync(fd);

  try {
    renameSync(tempPath, target);
  } catch (error) {
    unlinkQuietly(tempPath);
    throw error;
  }
}

const LOCK_ATTEMPTS = 10;
const LOCK_WAIT_MS = 50;

function sleep(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/**
 * Hold `<kubeconfig>.lock` while running `fn`. kubectl uses the same lock
 * file, so concurrent kubectl writes and ours exclude each other.
 */
function withLock<T>(target: string, fn: () => T): T {
  const lockPath = `${target}.lock`;
  let fd: number | undefined;

  for (let attempt = 0; attempt < LOCK_ATTEMPTS && fd === undefined; attempt++) {
    try {
      fd = openSync(lockPath, "wx", NEW_FILE_MODE);
    } catch (error) {
      if (errorCode(error) !== "EEXIST") throw error;
      sleep(LOCK_WAIT_MS);
    }
  }

  if (fd === undefined) {
    throw new KubeconfigError(
      `Kubeconfig is locked by another process (${lockPath})`,
      "Retry in a moment. If no kubectl command is running, delete the stale lock file"
    );
  }

  closeSync(fd);
  try {
    return fn();
  } finally {
    unlinkQuietly(lockPath);
  }
}

/**
 * Resolve symlinks so the real file is replaced, not the link.
 * A path that does not exist yet is returned as-is.
 */
function resolveWriteTarget(kubeconfigPath: string): string {
  try {
    return realpathSync(kubeconfigPath);
  } catch (error) {
    if (errorCode(error) !== "ENOENT") throw error;
  }

  try {
    lstatSync(kubeconfigPath);
  } catch {
    return kubeconfigPath;
  }
  throw new KubeconfigError(
    `${kubeconfigPath} is a symlink to a file that does not exist`,
    "Fix or remove the symlink, or set the Kubeconfig Path preference"
  );
}

/**
 * Write a kubeconfig back to disk, preserving comments and file mode
 */
export function writeKubeconfigFile(config: KubeConfig, kubeconfigPath: string): void {
  if (!isPlainObject(config)) {
    throw new ValidationError("Invalid kubeconfig data", "Ensure the configuration object is valid");
  }

  try {
    const target = resolveWriteTarget(kubeconfigPath);

    withLock(target, () => {
      let mode = NEW_FILE_MODE;
      let currentStat: ReturnType<typeof statSync> | undefined;
      try {
        currentStat = statSync(target);
        mode = currentStat.mode & 0o777;
      } catch (error) {
        if (errorCode(error) !== "ENOENT") throw error;
      }

      const candidate = sources.get(config);
      const source = candidate?.path === target ? candidate : undefined;

      if (source && (!currentStat || currentStat.mtimeMs !== source.mtimeMs || currentStat.size !== source.size)) {
        throw new KubeconfigError(
          "Kubeconfig changed on disk while it was being edited",
          "Another tool modified the file. Retry the action"
        );
      }

      // Sync into a copy so a failed write leaves the remembered document untouched
      let doc: Document;
      if (source) {
        doc = source.doc.clone();
        doc.contents = syncNode(doc.contents, config, doc) as Document["contents"];
      } else {
        doc = new Document(config);
      }

      const content = doc.toString({ flowCollectionPadding: false });
      if (!content.trim()) {
        throw new KubeconfigError("Empty kubeconfig content", "Configuration data appears to be empty");
      }

      atomicWrite(target, content, mode);

      const written = statSync(target);
      sources.set(config, { doc, path: target, mtimeMs: written.mtimeMs, size: written.size });
    });
  } catch (error) {
    if (error instanceof KubeconfigError || error instanceof ValidationError) {
      throw error;
    }
    throw toFileError(error, kubeconfigPath, "write");
  }
}
