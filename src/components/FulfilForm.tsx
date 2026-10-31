"use client";

import { useActionState } from "react";
import type { FulfillmentStatus } from "@prisma/client";
import { advanceOrder, type SellerFormState } from "@/app/actions/seller";

const LABEL: Partial<Record<FulfillmentStatus, string>> = {
  PACKED: "Mark as packed",
  SHIPPED: "Mark as shipped",
  DELIVERED: "Mark as delivered",
};

export function FulfilForm({ sellerOrderId, next, canCancel }: { sellerOrderId: string; next: FulfillmentStatus; canCancel: boolean }) {
  const [state, action, pending] = useActionState<SellerFormState, FormData>(advanceOrder, {});
  return (
    <form action={action} className="stack-sm">
      <input type="hidden" name="sellerOrderId" value={sellerOrderId} />
      {next === "SHIPPED" && (
        <div className="form-grid form-grid--2">
          <label className="field">
            <span>Courier</span>
            <input className="input input--sm" name="carrier" placeholder="Delhivery, India Post…" />
          </label>
          <label className="field">
            <span>Tracking number</span>
            <input className="input input--sm" name="trackingNumber" required />
          </label>
        </div>
      )}
      {state.error && <p className="form-error">{state.error}</p>}
      <div className="row">
        <button name="to" value={next} className="btn btn--primary btn--sm" disabled={pending}>
          {LABEL[next]}
        </button>
        {canCancel && (
          <button
            name="to"
            value="CANCELLED"
            className="btn btn--danger-text btn--sm"
            disabled={pending}
            formNoValidate
            onClick={(e) => {
              if (!confirm("Cancel this order? The buyer will be refunded.")) e.preventDefault();
            }}
          >
            Cancel order
          </button>
        )}
      </div>
    </form>
  );
}
