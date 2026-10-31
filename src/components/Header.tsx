import Link from "next/link";
import { SITE } from "@/config";
import { getCurrentUser } from "@/server/auth";
import { cartCount } from "@/server/cart";
import { BagIcon, StoreIcon, UserIcon } from "./icons";
import { SearchBox } from "./SearchBox";
import { TabBar } from "./TabBar";

export async function Header() {
  const [user, count] = await Promise.all([getCurrentUser(), cartCount()]);
  const sellLink =
    user?.role === "SELLER" ? { href: "/seller", label: "Your store" } : { href: "/sell", label: "Sell on " + SITE.name };

  return (
    <>
      <header className="header">
        <div className="container header__inner">
          <Link href="/" className="wordmark" aria-label={`${SITE.name} home`}>
            {SITE.name}
          </Link>
          <div className="header__search">
            <SearchBox id="q-header" />
          </div>
          <nav className="header__nav header__desktop" aria-label="Account">
            <Link className="header__link" href={sellLink.href}>
              <StoreIcon size={18} />
              {sellLink.label}
            </Link>
            {user?.role === "ADMIN" && (
              <Link className="header__link" href="/admin">
                Admin panel
              </Link>
            )}
            <Link className="header__link" href={user ? "/account" : "/login"}>
              <UserIcon size={18} />
              {user ? user.name.split(" ")[0] : "Sign in"}
            </Link>
            <Link className="header__link" href="/cart">
              <BagIcon size={18} />
              Cart
              {count > 0 && (
                <span className="count" key={count}>
                  {count}
                </span>
              )}
            </Link>
          </nav>
          <nav className="header__nav header__mobile" aria-label="Sell">
            <Link className="header__link" href={sellLink.href}>
              {user?.role === "SELLER" ? "Your store" : "Sell"}
            </Link>
          </nav>
        </div>
      </header>
      <TabBar cartCount={count} />
    </>
  );
}
