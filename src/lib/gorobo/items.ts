import type { GoroboItem } from "@/lib/gorobo/schema";

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
