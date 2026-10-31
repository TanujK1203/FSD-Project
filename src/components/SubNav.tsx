"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function SubNav({ items, label }: { items: { href: string; label: string; exact?: boolean }[]; label: string }) {
  const path = usePathname();
  return (
    <nav className="subnav" aria-label={label}>
      {items.map((i) => {
        const active = i.exact ? path === i.href : path === i.href || path.startsWith(i.href + "/");
        return (
          <Link key={i.href} href={i.href} aria-current={active ? "page" : undefined}>
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
