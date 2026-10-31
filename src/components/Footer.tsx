import Link from "next/link";
import { SITE } from "@/config";
import { ThemeSwitch } from "./ThemeSwitch";

export function Footer() {
  return (
    <footer className="footer">
      <div className="container footer__inner">
        <nav aria-label="Footer">
          <span className="strong" style={{ color: "var(--ink)" }}>
            {SITE.name}
          </span>
          <Link href="/sell">Sell with us</Link>
          <Link href="/orders">Your orders</Link>
          <Link href="/search">All products</Link>
        </nav>
        <ThemeSwitch />
      </div>
    </footer>
  );
}
