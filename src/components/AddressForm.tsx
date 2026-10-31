"use client";

import { useActionState, useEffect, useRef } from "react";
import { saveAddress, type AddressState } from "@/app/actions/account";
import { STATES } from "@/lib/india";

export function AddressForm({ next, defaultName, submitLabel = "Save address" }: { next?: string; defaultName?: string; submitLabel?: string }) {
  const [state, action, pending] = useActionState<AddressState, FormData>(saveAddress, {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);

  return (
    <form ref={ref} action={action} className="form-grid form-grid--2">
      {next && <input type="hidden" name="next" value={next} />}
      <label className="field">
        <span>Full name</span>
        <input className="input" name="name" autoComplete="name" defaultValue={defaultName} required />
      </label>
      <label className="field">
        <span>Mobile number</span>
        <input className="input" name="phone" type="tel" inputMode="numeric" autoComplete="tel-national" placeholder="10 digits" required />
      </label>
      <label className="field span-2">
        <span>House, building, street</span>
        <input className="input" name="line1" autoComplete="address-line1" required />
      </label>
      <label className="field span-2">
        <span>
          Area, landmark <span className="muted" style={{ fontWeight: 400 }}>(optional)</span>
        </span>
        <input className="input" name="line2" autoComplete="address-line2" />
      </label>
      <label className="field">
        <span>City</span>
        <input className="input" name="city" autoComplete="address-level2" required />
      </label>
      <label className="field">
        <span>PIN code</span>
        <input className="input" name="pincode" inputMode="numeric" autoComplete="postal-code" maxLength={6} required />
      </label>
      <label className="field span-2">
        <span>State</span>
        <select className="select" name="state" autoComplete="address-level1" defaultValue="" required>
          <option value="" disabled>
            Choose a state
          </option>
          {STATES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </label>
      <label className="check span-2">
        <input type="checkbox" name="isDefault" /> Use as my default address
      </label>
      {state.error && (
        <p className="form-error span-2" role="alert">
          {state.error}
        </p>
      )}
      <div className="span-2">
        <button className="btn btn--secondary" disabled={pending}>
          {pending ? "Saving" : submitLabel}
        </button>
      </div>
    </form>
  );
}
