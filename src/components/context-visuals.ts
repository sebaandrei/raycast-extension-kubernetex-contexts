import { Color, Icon, List } from "@raycast/api";
import { KubernetesContext } from "../types";

/** Current context: green check; others: plain circle. Production keeps its red tint. */
export function contextIcon(context: Pick<KubernetesContext, "current">, isProd: boolean): List.Item.Props["icon"] {
  const source = context.current ? Icon.CheckCircle : Icon.Circle;
  const tintColor = isProd ? Color.Red : context.current ? Color.Green : undefined;
  return {
    value: tintColor ? { source, tintColor } : source,
    tooltip: context.current ? "Current context" : "",
  };
}

/** Zero or one accessory; spread into an accessories array. */
export function prodAccessory(isProd: boolean): List.Item.Accessory[] {
  return isProd ? [{ tag: { value: "PROD", color: Color.Red }, tooltip: "Production context" }] : [];
}

/** Zero or one accessory showing EKS / AKS / GKE. */
export function providerAccessory(context: Pick<KubernetesContext, "cloudProvider">): List.Item.Accessory[] {
  return context.cloudProvider ? [{ tag: context.cloudProvider, tooltip: "Cloud provider" }] : [];
}

/** Short row subtitle: `cluster • user`. */
export function contextSubtitle(context: KubernetesContext): string {
  return [context.cluster, context.user].filter(Boolean).join(" • ");
}

/** Extra search terms so the native filter finds contexts by cluster, user, namespace and server. */
export function contextKeywords(context: KubernetesContext): string[] {
  const details = context.clusterDetails;
  return [
    context.cluster,
    context.user,
    context.namespace,
    details?.hostname,
    details?.server,
    details && `${details.hostname}:${details.port}`,
  ].filter((keyword): keyword is string => !!keyword);
}

/** Server address for the row tooltip. */
export function serverLabel(context: KubernetesContext): string | undefined {
  const details = context.clusterDetails;
  return details ? `${details.hostname}:${details.port}` : undefined;
}

/** Current context first, others keep their order. */
export function currentFirst(contexts: KubernetesContext[]): KubernetesContext[] {
  return [...contexts].sort((a, b) => Number(!!b.current) - Number(!!a.current));
}
