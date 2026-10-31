"use client";

import { useActionState } from "react";
import { updateProfile, type AddressState } from "@/app/actions/account";

export function ProfileForm({ name, phone }: { name: string; phone: string }) {
  const [state, action, pending] = useActionState<AddressState, FormData>(updateProfile, {});
  return (
    <form action={action} className="form-grid form-grid--2">
      <label className="field">
        <span>Name</span>
        <input className="input" name="name" defaultValue={name} autoComplete="name" />
      </label>
      <label className="field">
        <span>Mobile number</span>
        <input className="input" name="phone" type="tel" defaultValue={phone} autoComplete="tel-national" />
      </label>
      <div className="span-2 row">
        <button className="btn btn--secondary btn--sm" disabled={pending}>
          {pending ? "Saving" : "Save profile"}
        </button>
        {state.ok && <span className="small muted">Saved</span>}
        {state.error && <span className="form-error">{state.error}</span>}
      </div>
    </form>
  );
}
