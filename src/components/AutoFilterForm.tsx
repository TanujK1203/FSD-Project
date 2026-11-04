"use client";

import { useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";

const TYPING_DELAY_MS = 500;

/** Filter form that updates the results on every change, without an Apply button. */
export function AutoFilterForm({
  className,
  values,
  children,
}: {
  className?: string;
  values: Record<string, string | undefined>;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [pending, startTransition] = useTransition();

  const apply = () => {
    clearTimeout(timer.current);
    if (!form.current) return;
    const query = new URLSearchParams();
    for (const [name, value] of new FormData(form.current)) if (value) query.set(name, String(value));
    const search = query.toString();
    startTransition(() => router.replace(`/search${search ? `?${search}` : ""}`, { scroll: false }));
  };

  const onChange = (e: React.ChangeEvent<HTMLFormElement>) => {
    if (e.target.type === "number") {
      clearTimeout(timer.current);
      timer.current = setTimeout(apply, TYPING_DELAY_MS);
    } else {
      apply();
    }
  };

  useEffect(() => () => clearTimeout(timer.current), []);

  // keep the controls in step when links such as "Clear all" change the filters
  const synced = JSON.stringify(values);
  useEffect(() => {
    const current = JSON.parse(synced) as Record<string, string | undefined>;
    for (const el of Array.from(form.current?.elements ?? [])) {
      if (!(el instanceof HTMLInputElement || el instanceof HTMLSelectElement) || el.type === "hidden") continue;
      if (el === document.activeElement && el.type === "number") continue;
      const value = current[el.name] ?? "";
      if (el instanceof HTMLInputElement && el.type === "radio") el.checked = el.value === value;
      else el.value = value;
    }
  }, [synced]);

  return (
    <form
      ref={form}
      action="/search"
      className={className}
      aria-busy={pending}
      onChange={onChange}
      onSubmit={(e) => {
        e.preventDefault();
        apply();
      }}
    >
      {children}
    </form>
  );
}
