import { COMMERCE } from "@/config";

export function shippingForSeller(subtotalPaise: number): number {
  if (subtotalPaise <= 0) return 0;
  return subtotalPaise >= COMMERCE.freeShippingThresholdPaise ? 0 : COMMERCE.shippingPerSellerPaise;
}

export function commissionFor(grossPaise: number, rate = COMMERCE.commissionRate): number {
  return Math.round(grossPaise * rate);
}

export type LineInput = { storeId: string; unitPaise: number; quantity: number };

export type SellerSplit<T extends LineInput> = {
  storeId: string;
  lines: T[];
  subtotalPaise: number;
  shippingPaise: number;
};

/** Group cart lines by seller and work out per-seller subtotal and shipping. Order of first appearance is kept. */
export function splitBySeller<T extends LineInput>(lines: T[]) {
  const groups = new Map<string, SellerSplit<T>>();
  for (const line of lines) {
    let g = groups.get(line.storeId);
    if (!g) {
      g = { storeId: line.storeId, lines: [], subtotalPaise: 0, shippingPaise: 0 };
      groups.set(line.storeId, g);
    }
    g.lines.push(line);
    g.subtotalPaise += line.unitPaise * line.quantity;
  }
  const sellers = [...groups.values()];
  for (const g of sellers) g.shippingPaise = shippingForSeller(g.subtotalPaise);
  const subtotalPaise = sellers.reduce((s, g) => s + g.subtotalPaise, 0);
  const shippingPaise = sellers.reduce((s, g) => s + g.shippingPaise, 0);
  return { sellers, subtotalPaise, shippingPaise, totalPaise: subtotalPaise + shippingPaise };
}

/** What a seller is owed for one seller order: gross includes shipping they fulfil; commission is on item subtotal only. */
export function payoutFor(subtotalPaise: number, shippingPaise: number) {
  const commissionPaise = commissionFor(subtotalPaise);
  const grossPaise = subtotalPaise + shippingPaise;
  return { grossPaise, commissionPaise, netPaise: grossPaise - commissionPaise };
}
