const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
});

/** Format integer paise as rupees, e.g. 129900 -> "₹1,299". Shows paise only when present. */
export function formatPaise(paise: number): string {
  if (paise % 100 === 0) {
    return inr.format(paise / 100).replace(/\.00$/, "");
  }
  return inr.format(paise / 100);
}

/** Parse a decimal rupee string or number ("1,299.50", 1299.5) into paise. Returns null if unparseable. */
export function rupeesToPaise(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  let n: number;
  if (typeof value === "number") n = value;
  else {
    // first number in the string, so "Rs. 1,299/-" reads as 1299 (not ".1299")
    const m = value.match(/\d[\d,]*(?:\.\d+)?/);
    if (!m) return null;
    n = Number(m[0].replace(/,/g, ""));
  }
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

/** Convert an amount in a currency's minor unit (e.g. "129900" with minorUnit 2) into paise. */
export function minorToPaise(value: string | number | null | undefined, minorUnit: number): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 10 ** (2 - minorUnit));
}

export function discountPercent(pricePaise: number, compareAtPaise: number | null | undefined): number | null {
  if (!compareAtPaise || compareAtPaise <= pricePaise) return null;
  const pct = Math.round(((compareAtPaise - pricePaise) / compareAtPaise) * 100);
  return pct >= 1 ? pct : null;
}
