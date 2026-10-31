import { describe, expect, it } from "vitest";
import { discountPercent, formatPaise, minorToPaise, rupeesToPaise } from "@/lib/money";
import { commissionFor, payoutFor, shippingForSeller, splitBySeller } from "@/lib/pricing";

describe("money", () => {
  it("formats paise as Indian rupees", () => {
    expect(formatPaise(129900)).toBe("₹1,299");
    expect(formatPaise(12345678)).toBe("₹1,23,456.78");
    expect(formatPaise(0)).toBe("₹0");
  });
  it("parses rupee strings", () => {
    expect(rupeesToPaise("1,299.50")).toBe(129950);
    expect(rupeesToPaise("₹ 499")).toBe(49900);
    expect(rupeesToPaise("Rs. 1,299/-")).toBe(129900);
    expect(rupeesToPaise(12.345)).toBe(1235);
    expect(rupeesToPaise("abc")).toBeNull();
    expect(rupeesToPaise(null)).toBeNull();
  });
  it("converts minor units", () => {
    expect(minorToPaise("129900", 2)).toBe(129900);
    expect(minorToPaise("1299", 0)).toBe(129900);
    expect(minorToPaise("", 2)).toBeNull();
  });
  it("computes discounts only when real", () => {
    expect(discountPercent(80000, 100000)).toBe(20);
    expect(discountPercent(100000, 100000)).toBeNull();
    expect(discountPercent(100000, null)).toBeNull();
  });
});

describe("pricing", () => {
  it("charges shipping per seller below the free threshold", () => {
    expect(shippingForSeller(50000)).toBe(4900);
    expect(shippingForSeller(99900)).toBe(0);
    expect(shippingForSeller(0)).toBe(0);
  });
  it("splits a cart by seller", () => {
    const r = splitBySeller([
      { storeId: "a", unitPaise: 50000, quantity: 1 },
      { storeId: "b", unitPaise: 120000, quantity: 1 },
      { storeId: "a", unitPaise: 20000, quantity: 2 },
    ]);
    expect(r.sellers.map((s) => s.storeId)).toEqual(["a", "b"]);
    expect(r.sellers[0]).toMatchObject({ subtotalPaise: 90000, shippingPaise: 4900 });
    expect(r.sellers[1]).toMatchObject({ subtotalPaise: 120000, shippingPaise: 0 });
    expect(r.totalPaise).toBe(90000 + 4900 + 120000);
  });
  it("takes commission on items only, passes shipping through", () => {
    expect(commissionFor(100000)).toBe(5000);
    expect(payoutFor(100000, 4900)).toEqual({ grossPaise: 104900, commissionPaise: 5000, netPaise: 99900 });
  });
});
