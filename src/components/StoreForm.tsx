"use client";

import { useActionState } from "react";
import { updateStore, type SellerFormState } from "@/app/actions/seller";

type S = { name: string; city: string; instagramHandle: string; bio: string; payoutUpi: string; logoUrl: string | null };

export function StoreForm({ store }: { store: S }) {
  const [state, action, pending] = useActionState<SellerFormState, FormData>(updateStore, {});
  return (
    <form action={action} className="panel form-grid form-grid--2">
      <label className="field span-2">
        <span>Store name</span>
        <input className="input" name="storeName" defaultValue={store.name} required />
      </label>
      <label className="field">
        <span>City</span>
        <input className="input" name="city" defaultValue={store.city} />
      </label>
      <label className="field">
        <span>Instagram</span>
        <input className="input" name="instagramHandle" defaultValue={store.instagramHandle} placeholder="@yourstore" />
      </label>
      <label className="field span-2">
        <span>About the store</span>
        <textarea className="textarea" name="bio" defaultValue={store.bio} maxLength={500} placeholder="What you make and how" />
      </label>
      <label className="field">
        <span>UPI ID for payouts</span>
        <input className="input" name="payoutUpi" defaultValue={store.payoutUpi} placeholder="name@okbank" autoCapitalize="none" />
      </label>
      <label className="field">
        <span>Logo</span>
        <span className="row" style={{ flexWrap: "nowrap" }}>
          {store.logoUrl && <img src={store.logoUrl} alt="" className="avatar" />}
          <input className="input" type="file" name="logo" accept="image/jpeg,image/png,image/webp" />
        </span>
      </label>
      {state.error && <p className="form-error span-2">{state.error}</p>}
      <div className="row span-2">
        <button className="btn btn--primary" disabled={pending}>
          {pending ? "Saving" : "Save store details"}
        </button>
        {state.ok && <span className="small muted">{state.message}</span>}
      </div>
    </form>
  );
}
