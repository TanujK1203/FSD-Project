"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BagIcon, HomeIcon, SearchIcon, UserIcon } from "./icons";

export function TabBar({ cartCount }: { cartCount: number }) {
  const path = usePathname();
  const is = (prefix: string) => (prefix === "/" ? path === "/" : path.startsWith(prefix));
  const accountActive =
    is("/account") || is("/orders") || is("/login") || is("/signup") || is("/seller") || is("/admin");

  return (
    <nav className="tabbar" aria-label="Main">
      <Link href="/" aria-current={is("/") ? "page" : undefined}>
        <span className="tabbar__icon">
          <HomeIcon />
        </span>
        Home
      </Link>
      <Link href="/search" aria-current={is("/search") ? "page" : undefined}>
        <span className="tabbar__icon">
          <SearchIcon />
        </span>
        Search
      </Link>
      <Link href="/cart" aria-current={is("/cart") || is("/checkout") ? "page" : undefined}>
        <span className="tabbar__icon">
          <BagIcon />
          {cartCount > 0 && (
            <span className="count" key={cartCount}>
              {cartCount}
            </span>
          )}
        </span>
        Cart
      </Link>
      <Link href="/account" aria-current={accountActive ? "page" : undefined}>
        <span className="tabbar__icon">
          <UserIcon />
        </span>
        Account
      </Link>
    </nav>
  );
}
