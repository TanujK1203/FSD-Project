"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { addToCart, type CartActionState } from "@/app/actions/cart";
import { discountPercent, formatPaise } from "@/lib/money";

export type BuyVariant = {
  id: string;
  name: string;
  options: Record<string, string>;
  pricePaise: number;
  available: boolean;
  stock: number | null;
};

export function BuyBox({
  variants,
  compareAtPaise,
}: {
  variants: BuyVariant[];
  compareAtPaise: number | null;
}) {
  const optionNames = useMemo(() => {
    const names: string[] = [];
    for (const v of variants) for (const k of Object.keys(v.options)) if (!names.includes(k)) names.push(k);
    return names;
  }, [variants]);

  const firstBuyable = variants.find((v) => v.available && (v.stock === null || v.stock > 0)) ?? variants[0]!;
  const [selected, setSelected] = useState<Record<string, string>>(firstBuyable.options);
  const [state, action, pending] = useActionState<CartActionState, FormData>(addToCart, { ok: false });

  const match =
    optionNames.length === 0
      ? variants.length === 1
        ? variants[0]
        : variants.find((v) => v.id === (selected.__id ?? firstBuyable.id))
      : variants.find((v) => optionNames.every((n) => v.options[n] === selected[n]));

  const isBuyable = (v?: BuyVariant) => !!v && v.available && (v.stock === null || v.stock > 0);
  const price = match?.pricePaise ?? firstBuyable.pricePaise;
  const off = discountPercent(price, compareAtPaise);

  // options without names (e.g. imported variants with only a title) fall back to a single picker
  const unnamed = optionNames.length === 0 && variants.length > 1;

  return (
    <div className="stack">
      <div className="row" style={{ alignItems: "baseline", gap: "var(--s2)" }}>
        <span className={`price${off ? " price-sale" : ""}`} style={{ fontSize: "var(--fs-xl)" }}>
          {formatPaise(price)}
        </span>
        {off && compareAtPaise ? (
          <>
            <span className="price-was" style={{ fontSize: "var(--fs-base)" }}>
              {formatPaise(compareAtPaise)}
            </span>
            <span className="badge badge--accent">{off}% off</span>
          </>
        ) : null}
      </div>

      {optionNames.map((name) => {
        const values = [...new Set(variants.map((v) => v.options[name]).filter(Boolean))] as string[];
        return (
          <fieldset key={name} style={{ border: 0, padding: 0, margin: 0 }} className="stack-sm">
            <legend className="label" style={{ marginBottom: 8 }}>
              {name}
              {selected[name] ? <span className="muted" style={{ fontWeight: 400 }}>: {selected[name]}</span> : null}
            </legend>
            <div className="row" style={{ gap: 8 }}>
              {values.map((val) => {
                const candidate = variants.find((v) =>
                  optionNames.every((n) => (n === name ? v.options[n] === val : v.options[n] === selected[n])),
                );
                const disabled = !isBuyable(candidate);
                return (
                  <button
                    key={val}
                    type="button"
                    className="chip"
                    aria-pressed={selected[name] === val}
                    onClick={() => setSelected((s) => ({ ...s, [name]: val }))}
                    style={disabled ? { textDecoration: "line-through", opacity: 0.55 } : undefined}
                  >
                    {val}
                  </button>
                );
              })}
            </div>
          </fieldset>
        );
      })}

      {unnamed && (
        <label className="field">
          <span>Option</span>
          <select
            className="select"
            value={selected.__id ?? firstBuyable.id}
            onChange={(e) => setSelected({ __id: e.target.value })}
          >
            {variants.map((v) => (
              <option key={v.id} value={v.id} disabled={!isBuyable(v)}>
                {v.name}
                {!isBuyable(v) ? " (sold out)" : ""}
              </option>
            ))}
          </select>
        </label>
      )}

      <form action={action} className="stack-sm">
        <input type="hidden" name="variantId" value={match?.id ?? ""} />
        <button className="btn btn--primary btn--block" disabled={pending || !isBuyable(match)}>
          {!match ? "Choose an option" : !isBuyable(match) ? "Sold out" : pending ? "Adding" : "Add to cart"}
        </button>
        <div aria-live="polite" className="small" style={{ minHeight: "1.5em" }}>
          {state.ok && state.at ? (
            <span>
              Added to your cart. <Link href="/cart" className="strong" style={{ textDecoration: "underline" }}>View cart</Link>
            </span>
          ) : state.message ? (
            <span className="form-error">{state.message}</span>
          ) : match?.stock !== null && match?.stock !== undefined && match.stock > 0 && match.stock <= 5 ? (
            <span className="muted">Only {match.stock} left</span>
          ) : null}
        </div>
      </form>
    </div>
  );
}
