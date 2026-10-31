"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login, signup, type FormState } from "@/app/actions/auth";

export function AuthForm({ mode, next }: { mode: "login" | "signup"; next?: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(mode === "login" ? login : signup, {});
  const qs = next ? `?next=${encodeURIComponent(next)}` : "";

  return (
    <form action={action} className="stack" noValidate>
      <input type="hidden" name="next" value={next ?? ""} />
      {mode === "signup" && (
        <label className="field">
          <span>Name</span>
          <input className="input" name="name" autoComplete="name" required defaultValue={state.fields?.name} />
        </label>
      )}
      <label className="field">
        <span>Email</span>
        <input
          className="input"
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={state.fields?.email}
        />
      </label>
      <label className="field">
        <span>Password</span>
        <input
          className="input"
          name="password"
          type="password"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          required
          minLength={mode === "signup" ? 8 : undefined}
        />
        {mode === "signup" && <span className="hint">At least 8 characters</span>}
      </label>
      {state.error && (
        <p className="form-error" role="alert">
          {state.error}
        </p>
      )}
      <button className="btn btn--primary btn--block" disabled={pending}>
        {mode === "login" ? (pending ? "Signing in" : "Sign in") : pending ? "Creating account" : "Create account"}
      </button>
      <p className="small muted" style={{ textAlign: "center" }}>
        {mode === "login" ? (
          <>
            New here? <Link href={`/signup${qs}`} className="strong" style={{ color: "var(--ink)" }}>Create an account</Link>
          </>
        ) : (
          <>
            Have an account? <Link href={`/login${qs}`} className="strong" style={{ color: "var(--ink)" }}>Sign in</Link>
          </>
        )}
      </p>
    </form>
  );
}
