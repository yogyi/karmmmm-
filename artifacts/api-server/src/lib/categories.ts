import { prisma } from "@workspace/db";

function slugifyCategory(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || "other"
  );
}

export function readCustomCategory(body: unknown): string {
  if (!body || typeof body !== "object") return "";
  const value = (body as { customCategory?: unknown }).customCategory;
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, 80) : "";
}

export async function findOrCreateCategory(rawName: string) {
  const name = rawName.trim().replace(/\s+/g, " ").slice(0, 80);
  if (name.length < 2) {
    throw new Error("Enter a custom category name");
  }

  const existing = await prisma.category.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
  });
  if (existing) return existing;

  const baseSlug = slugifyCategory(name);
  let slug = baseSlug;
  let n = 2;
  while (await prisma.category.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${n++}`;
  }

  return prisma.category.create({
    data: {
      name,
      slug,
      description: "Custom category",
    },
  });
}
