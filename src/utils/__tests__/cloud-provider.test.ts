import { describe, expect, it } from "vitest";
import { detectCloudProvider } from "../cloud-provider";

describe("detectCloudProvider", () => {
  it.each([
    ["aws-iam-authenticator", "EKS"],
    ["kubelogin", "AKS"],
    ["gke-gcloud-auth-plugin", "GKE"],
  ])("maps exec %s to %s", (execCommand, expected) => {
    expect(detectCloudProvider({ execCommand })).toBe(expected);
  });

  it("uses the basename, case-insensitively", () => {
    expect(detectCloudProvider({ execCommand: "/usr/local/bin/KubeLogin" })).toBe("AKS");
    expect(detectCloudProvider({ execCommand: "C:\\tools\\kubelogin.exe" })).toBe("AKS");
    expect(detectCloudProvider({ execCommand: "/opt/gcloud/bin/gke-gcloud-auth-plugin" })).toBe("GKE");
  });

  it("treats aws as EKS only for the eks auth flow", () => {
    expect(detectCloudProvider({ execCommand: "aws", execArgs: ["eks", "get-token"] })).toBe("EKS");
    expect(detectCloudProvider({ execCommand: "aws", execArgs: ["sts", "get-caller-identity"] })).toBeUndefined();
    expect(detectCloudProvider({ execCommand: "aws" })).toBeUndefined();
  });

  it("does not badge generic CLIs", () => {
    for (const execCommand of ["az", "gcloud", "aws-vault"]) {
      expect(detectCloudProvider({ execCommand })).toBeUndefined();
    }
  });

  it("does not match on substrings", () => {
    expect(detectCloudProvider({ execCommand: "awsome" })).toBeUndefined();
    expect(detectCloudProvider({ execCommand: "my-az-tool" })).toBeUndefined();
  });

  it("detects from the server host", () => {
    expect(detectCloudProvider({ server: "https://ABC.gr7.eu-west-1.eks.amazonaws.com" })).toBe("EKS");
    expect(detectCloudProvider({ server: "https://x.eks.amazonaws.com.cn:443" })).toBe("EKS");
    expect(detectCloudProvider({ server: "https://x.hcp.westeurope.azmk8s.io:443" })).toBe("AKS");
    expect(detectCloudProvider({ server: "https://x.azmk8s.us" })).toBe("AKS");
    expect(detectCloudProvider({ server: "https://x.azmk8s.cn" })).toBe("AKS");
    expect(detectCloudProvider({ server: "https://container.googleapis.com/v1/projects/p" })).toBe("GKE");
  });

  it("does not match lookalike hosts", () => {
    expect(detectCloudProvider({ server: "https://eks.amazonaws.com.evil.com" })).toBeUndefined();
    expect(detectCloudProvider({ server: "https://evilcontainer.googleapis.com" })).toBeUndefined();
    expect(detectCloudProvider({ server: "https://foo.example.com:6443" })).toBeUndefined();
  });

  it("exec command wins over host", () => {
    expect(detectCloudProvider({ execCommand: "kubelogin", server: "https://x.eks.amazonaws.com" })).toBe("AKS");
  });

  it("falls back to host when exec is unknown", () => {
    expect(detectCloudProvider({ execCommand: "custom", server: "https://x.eks.amazonaws.com" })).toBe("EKS");
  });

  it("returns undefined for nothing", () => {
    expect(detectCloudProvider({})).toBeUndefined();
    expect(detectCloudProvider({ execArgs: ["a"], server: "" })).toBeUndefined();
  });
});
