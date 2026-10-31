"use client";

import { useEffect, useState } from "react";

type Mode = "system" | "light" | "dark";

function apply(mode: Mode) {
  const root = document.documentElement;
  if (mode === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", mode);
}

export function ThemeSwitch() {
  const [mode, setMode] = useState<Mode>("system");

  useEffect(() => {
    let saved: Mode = "system";
    try {
      const v = localStorage.getItem("theme");
      if (v === "light" || v === "dark") saved = v;
    } catch {}
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync from localStorage after mount
    setMode(saved);
  }, []);

  function choose(next: Mode) {
    setMode(next);
    apply(next);
    try {
      if (next === "system") localStorage.removeItem("theme");
      else localStorage.setItem("theme", next);
    } catch {}
  }

  return (
    <div className="segmented" role="group" aria-label="Appearance">
      {(["system", "light", "dark"] as const).map((m) => (
        <button key={m} type="button" aria-pressed={mode === m} onClick={() => choose(m)}>
          {m === "system" ? "Auto" : m === "light" ? "Light" : "Dark"}
        </button>
      ))}
    </div>
  );
}

/** Runs before paint to avoid a flash of the wrong theme. */
export const themeInitScript = `try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}`;
