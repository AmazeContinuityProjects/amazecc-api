import type { GoroboItem } from "@/lib/gorobo/schema";

/** Deterministic slug id from a name, matching the GoRobo catalog convention. */
export function slugifyId(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "item"
  );
}

export function mapItemRow(r: GoroboItem) {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    price: Number(r.price),
    basePrice: Number(r.base_price),
    margin: Number(r.margin),
    category: r.category,
    inStock: r.in_stock,
    image: r.image,
    updatedAt: r.updated_at,
  };
}

/** Selling price = raw cost + margin (locked decision). */
export const computePrice = (basePrice: number, margin: number) =>
  Math.round((basePrice + margin) * 100) / 100;
