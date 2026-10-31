"use client";

import { useActionState } from "react";
import { startImport, type SellerFormState } from "@/app/actions/seller";

export function ImportForm({ defaultUrl, secondary = false }: { defaultUrl: string; secondary?: boolean }) {
  const [state, action, pending] = useActionState<SellerFormState, FormData>(startImport, {});
  return (
    <form action={action} className="stack-sm">
      <label className="visually-hidden" htmlFor="store-url">
        Store link
      </label>
      <div className="row" style={{ flexWrap: "nowrap", gap: "var(--s2)" }}>
        <input
          id="store-url"
          className="input"
          name="url"
          inputMode="url"
          autoCapitalize="none"
          autoCorrect="off"
          placeholder="yourstore.in"
          defaultValue={defaultUrl}
          required
        />
        <button className={`btn ${secondary ? "btn--secondary" : "btn--primary"}`} disabled={pending}>
          {pending ? "Starting" : "Import"}
        </button>
      </div>
      {state.error && (
        <p className="form-error" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
