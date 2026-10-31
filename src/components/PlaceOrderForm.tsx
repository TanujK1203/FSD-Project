"use client";

import { useActionState } from "react";
import { placeOrderAction, type CheckoutState } from "@/app/actions/checkout";

type Addr = { id: string; label: string; phone: string; isDefault: boolean };

export function PlaceOrderForm({ formId, addresses }: { formId: string; addresses: Addr[] }) {
  const [state, action, pending] = useActionState<CheckoutState, FormData>(placeOrderAction, {});
  const defaultId = (addresses.find((a) => a.isDefault) ?? addresses[0])?.id;
  return (
    <form id={formId} action={action} className="stack-sm" aria-busy={pending}>
      {addresses.map((a) => (
        <label key={a.id} className="addr-option">
          <input type="radio" name="addressId" value={a.id} defaultChecked={a.id === defaultId} />
          <span>
            <span className="small">{a.label}</span>
            <span className="xsmall muted" style={{ display: "block" }}>
              {a.phone}
            </span>
          </span>
        </label>
      ))}
      {state.error && (
        <p className="form-error" role="alert">
          {state.error}
        </p>
      )}
      {pending && <p className="small muted">Placing your order</p>}
    </form>
  );
}
