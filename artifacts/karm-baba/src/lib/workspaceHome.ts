/**
 * Workspace “logo home” — where the brand mark should send you.
 * Sellers stay in Seller Central; buyers in Buyer Central; guests on the marketplace.
 */
export function workspaceHomePath(
  role: string | null | undefined,
): "/" | "/seller" | "/buyer" {
  if (role === "seller" || role === "admin") return "/seller";
  if (role === "buyer") return "/buyer";
  return "/";
}
