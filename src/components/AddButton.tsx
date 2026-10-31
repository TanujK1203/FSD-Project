"use client";

import { useActionState, useEffect, useState } from "react";
import { addToCart, type CartActionState } from "@/app/actions/cart";

export function AddButton({ variantId, label = "Add" }: { variantId: string; label?: string }) {
  const [state, action, pending] = useActionState<CartActionState, FormData>(addToCart, { ok: false });
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    if (!state.at) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- brief confirmation after the action resolves
    setFlash(true);
    const t = setTimeout(() => setFlash(false), 1400);
    return () => clearTimeout(t);
  }, [state.at]);

  return (
    <form action={action}>
      <input type="hidden" name="variantId" value={variantId} />
      <button className="btn btn--secondary" disabled={pending} aria-live="polite">
        {pending ? "Adding" : flash ? "Added" : !state.ok && state.message ? "Unavailable" : label}
      </button>
    </form>
  );
}
