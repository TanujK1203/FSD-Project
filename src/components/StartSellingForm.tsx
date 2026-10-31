"use client";

import Link from "next/link";
import { useActionState } from "react";
import { startSelling, type SellerFormState } from "@/app/actions/seller";

export function StartSellingForm({ signedIn, defaultName }: { signedIn: boolean; defaultName?: string }) {
  const [state, action, pending] = useActionState<SellerFormState, FormData>(startSelling, {});
  return (
    <form action={action} className="stack">
      <label className="field">
        <span>Store name</span>
        <input className="input" name="storeName" required maxLength={60} placeholder="As buyers know it" />
      </label>
      <div className="form-grid form-grid--2">
        <label className="field">
          <span>
            City <span className="muted" style={{ fontWeight: 400 }}>(optional)</span>
          </span>
          <input className="input" name="city" autoComplete="address-level2" />
        </label>
        <label className="field">
          <span>
            Instagram <span className="muted" style={{ fontWeight: 400 }}>(optional)</span>
          </span>
          <input className="input" name="instagramHandle" placeholder="@yourstore" autoCapitalize="none" />
        </label>
      </div>

      {!signedIn && (
        <fieldset className="stack" style={{ border: 0, padding: 0, margin: "var(--s3) 0 0" }}>
          <legend className="label" style={{ marginBottom: "var(--s3)" }}>
            Your login
          </legend>
          <label className="field">
            <span>Your name</span>
            <input className="input" name="name" autoComplete="name" required defaultValue={defaultName} />
          </label>
          <label className="field">
            <span>Email</span>
            <input className="input" name="email" type="email" autoComplete="email" required />
          </label>
          <label className="field">
            <span>Password</span>
            <input className="input" name="password" type="password" autoComplete="new-password" minLength={8} required />
            <span className="hint">At least 8 characters</span>
          </label>
        </fieldset>
      )}

      {state.error && (
        <p className="form-error" role="alert">
          {state.error}
        </p>
      )}
      <button className="btn btn--primary btn--block" disabled={pending}>
        {pending ? "Creating your store" : "Continue to import"}
      </button>
      {!signedIn && (
        <p className="small muted" style={{ textAlign: "center" }}>
          Already shop here? <Link href="/login?next=/sell/start" className="strong" style={{ color: "var(--ink)" }}>Sign in first</Link>
        </p>
      )}
    </form>
  );
}
