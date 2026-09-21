import { Color, Icon, List } from "@raycast/api";
import { KubernetesContext } from "../types";

export function contextIcon(context: Pick<KubernetesContext, "current">, isProd: boolean): List.Item.Props["icon"] {
  const source = context.current ? Icon.CheckCircle : Icon.Circle;
  return isProd ? { source, tintColor: Color.Red } : source;
}

/** Zero or one accessory; spread into an accessories array. */
export function prodAccessory(isProd: boolean): List.Item.Accessory[] {
  return isProd ? [{ tag: { value: "PROD", color: Color.Red }, tooltip: "Production context" }] : [];
}
