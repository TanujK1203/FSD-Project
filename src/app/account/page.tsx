import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/server/auth";
import { db } from "@/server/db";
import { logout } from "@/app/actions/auth";
import { deleteAddress, setDefaultAddress } from "@/app/actions/account";
import { AddressForm } from "@/components/AddressForm";
import { ProfileForm } from "@/components/ProfileForm";
import { ThemeSwitch } from "@/components/ThemeSwitch";
import { ChevronIcon } from "@/components/icons";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  const user = await requireUser("/account");
  const [addresses, store, orderCount] = await Promise.all([
    db.address.findMany({ where: { userId: user.id }, orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }] }),
    db.store.findUnique({ where: { ownerId: user.id }, select: { name: true, status: true } }),
    db.order.count({ where: { userId: user.id } }),
  ]);

  const links = [
    { href: "/orders", label: "Your orders", detail: orderCount ? `${orderCount}` : undefined },
    store
      ? { href: "/seller", label: "Your store", detail: store.name }
      : { href: "/sell", label: "Sell with us", detail: "Import your store" },
    ...(user.role === "ADMIN" ? [{ href: "/admin", label: "Admin", detail: undefined }] : []),
  ];

  return (
    <div className="container container--narrow stack-lg">
      <div className="row row--between">
        <div>
          <h1>{user.name}</h1>
          <p className="small muted">{user.email}</p>
        </div>
        <form action={logout}>
          <button className="btn btn--ghost btn--sm">Sign out</button>
        </form>
      </div>

      <ul className="list panel" style={{ padding: 0 }}>
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="order-row" style={{ gridTemplateColumns: "1fr auto auto" }}>
              <span className="strong">{l.label}</span>
              <span className="small muted">{l.detail}</span>
              <ChevronIcon />
            </Link>
          </li>
        ))}
      </ul>

      <section className="stack" aria-labelledby="addr-h">
        <h2 id="addr-h">Addresses</h2>
        {addresses.length > 0 && (
          <ul className="list panel" style={{ padding: 0 }}>
            {addresses.map((a) => (
              <li key={a.id} className="row row--between" style={{ padding: "var(--s3) var(--s4)", flexWrap: "nowrap", alignItems: "flex-start" }}>
                <div className="small" style={{ minWidth: 0 }}>
                  <span className="strong">{a.name}</span> {a.isDefault && <span className="badge">Default</span>}
                  <br />
                  {a.line1}
                  {a.line2 ? `, ${a.line2}` : ""}, {a.city}, {a.state} {a.pincode}
                  <br />
                  <span className="muted">{a.phone}</span>
                </div>
                <div className="row" style={{ gap: 4, flexWrap: "nowrap" }}>
                  {!a.isDefault && (
                    <form action={setDefaultAddress}>
                      <input type="hidden" name="id" value={a.id} />
                      <button className="btn btn--ghost btn--sm">Make default</button>
                    </form>
                  )}
                  <form action={deleteAddress}>
                    <input type="hidden" name="id" value={a.id} />
                    <button className="btn btn--danger-text btn--sm">Delete</button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
        <details className="panel" open={addresses.length === 0}>
          <summary className="strong small" style={{ cursor: "pointer" }}>
            Add an address
          </summary>
          <div style={{ marginTop: "var(--s4)" }}>
            <AddressForm defaultName={user.name} />
          </div>
        </details>
      </section>

      <section className="stack" aria-labelledby="profile-h">
        <h2 id="profile-h">Profile</h2>
        <div className="panel">
          <ProfileForm name={user.name} phone={user.phone ?? ""} />
        </div>
      </section>

      <section className="row row--between" aria-label="Appearance">
        <h2>Appearance</h2>
        <ThemeSwitch />
      </section>
    </div>
  );
}
