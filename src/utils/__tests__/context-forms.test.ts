import { describe, expect, it } from "vitest";
import { computeContextUpdates, describeRemoval, validateCreateContextForm } from "../context-forms";

const original = { name: "ctx", cluster: "c1", user: "u1", namespace: "ns" };

describe("computeContextUpdates", () => {
  it("returns nothing when unchanged", () => {
    expect(computeContextUpdates(original, { name: "ctx", cluster: "c1", user: "u1", namespace: "ns" })).toEqual({});
  });

  it("returns only changed, trimmed fields", () => {
    expect(computeContextUpdates(original, { name: " new ", cluster: "c2", user: "u1", namespace: " other " })).toEqual(
      { newName: "new", cluster: "c2", namespace: "other" }
    );
    expect(computeContextUpdates(original, { name: "ctx", cluster: " c1 ", user: "u2", namespace: "ns" })).toEqual({
      user: "u2",
    });
  });

  it("clears the namespace with an empty string", () => {
    expect(computeContextUpdates(original, { name: "ctx", namespace: "  " })).toEqual({ namespace: "" });
  });

  it("does not report a namespace change when both are empty", () => {
    expect(computeContextUpdates({ ...original, namespace: undefined }, { name: "ctx", namespace: "" })).toEqual({});
  });

  it("omits missing cluster/user values", () => {
    expect(computeContextUpdates(original, { name: "ctx", cluster: "", user: undefined, namespace: "ns" })).toEqual({});
  });
});

describe("validateCreateContextForm", () => {
  const existing = { useExistingCluster: true, useExistingUser: true };
  const manual = { useExistingCluster: false, useExistingUser: false };

  it("requires a name", () => {
    expect(validateCreateContextForm({ name: " " }, existing)).toEqual({ name: "Context name is required" });
  });

  it("uses cluster/user with existing toggles and clusterName/userName otherwise", () => {
    expect(validateCreateContextForm({ name: "n", clusterName: "c", userName: "u" }, existing)).toEqual({
      cluster: "Cluster name is required",
    });
    expect(validateCreateContextForm({ name: "n", cluster: "c" }, existing)).toEqual({
      user: "User name is required",
    });
    expect(validateCreateContextForm({ name: "n", cluster: "c", user: "u" }, existing)).toBeNull();
    expect(validateCreateContextForm({ name: "n", cluster: "c", user: "u" }, manual)).toEqual({
      cluster: "Cluster name is required",
    });
    expect(validateCreateContextForm({ name: "n", clusterName: "c", userName: " " }, manual)).toEqual({
      user: "User name is required",
    });
  });

  it("requires a server only for a new cluster", () => {
    expect(validateCreateContextForm({ name: "n", clusterName: "c", userName: "u" }, manual)).toEqual({
      server: "Server URL is required for a new cluster",
    });
    expect(
      validateCreateContextForm({ name: "n", clusterName: "c", userName: "u", clusterServer: "https://x" }, manual)
    ).toBeNull();
    expect(
      validateCreateContextForm({ name: "n", cluster: "c", userName: "u" }, { ...existing, useExistingUser: false })
    ).toBeNull();
  });

  it("validates a non-empty namespace only", () => {
    const base = { name: "n", cluster: "c", user: "u" };
    expect(validateCreateContextForm({ ...base, namespace: "" }, existing)).toBeNull();
    expect(validateCreateContextForm({ ...base, namespace: "  " }, existing)).toBeNull();
    expect(validateCreateContextForm({ ...base, namespace: "ok-ns" }, existing)).toBeNull();
    expect(validateCreateContextForm({ ...base, namespace: "Bad_NS" }, existing)?.namespace).toBeTruthy();
  });
});

describe("describeRemoval", () => {
  it("names both, one or neither", () => {
    expect(describeRemoval("x", { removedCluster: "a", removedUser: "b" })).toBe(
      "Deleted x and unused cluster a, user b"
    );
    expect(describeRemoval("x", { removedCluster: "a" })).toBe("Deleted x and unused cluster a");
    expect(describeRemoval("x", { removedUser: "b" })).toBe("Deleted x and unused user b");
    expect(describeRemoval("x", {})).toBe("Deleted x");
  });
});
