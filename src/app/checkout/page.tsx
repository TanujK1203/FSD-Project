import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/server/auth";
import { db } from "@/server/db";
import { getCartView } from "@/server/cart";
import { formatPaise } from "@/lib/money";
import { AddressForm } from "@/components/AddressForm";
import { PlaceOrderForm } from "@/components/PlaceOrderForm";
import styles from "../cart/cart.module.css";

export const metadata: Metadata = { title: "Checkout" };

export default async function CheckoutPage() {
  const user = await requireUser("/checkout");
  const [cart, addresses] = await Promise.all([
    getCartView(),
    db.address.findMany({ where: { userId: user.id }, orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }] }),
  ]);
  if (!cart.lines.length) redirect("/cart");
  if (cart.hasProblems) redirect("/cart");

  return (
    <div className="container">
      <h1 style={{ marginBottom: "var(--s5)" }}>Checkout</h1>
      <div className={styles.layout}>
        <div className="stack-lg">
          <section className="panel stack" aria-labelledby="addr-h">
            <h2 id="addr-h">Delivery address</h2>
            {addresses.length > 0 ? (
              <PlaceOrderForm
                formId="place-order"
                addresses={addresses.map((a) => ({
                  id: a.id,
                  label: `${a.name}, ${a.line1}${a.line2 ? `, ${a.line2}` : ""}, ${a.city}, ${a.state} ${a.pincode}`,
                  phone: a.phone,
                  isDefault: a.isDefault,
                }))}
              />
            ) : (
              <AddressForm next="/checkout" defaultName={user.name} submitLabel="Use this address" />
            )}
            {addresses.length > 0 && (
              <details>
                <summary className="small strong" style={{ cursor: "pointer" }}>
                  Add a new address
                </summary>
                <div style={{ marginTop: "var(--s4)" }}>
                  <AddressForm next="/checkout" defaultName={user.name} />
                </div>
              </details>
            )}
          </section>

          <section className="stack" aria-labelledby="items-h">
            <h2 id="items-h">
              {cart.groups.length > 1 ? `${cart.groups.length} shipments` : "Your items"}
            </h2>
            {cart.groups.map((g, i) => (
              <div key={g.storeId} className={styles.group}>
                <header className={styles.groupHead}>
                  <span className="strong">
                    {cart.groups.length > 1 ? `Shipment ${i + 1} from ` : "From "}
                    {g.storeName}
                  </span>
                  <span className="small muted num">
                    {g.shippingPaise ? `Shipping ${formatPaise(g.shippingPaise)}` : "Free shipping"}
                  </span>
                </header>
                <ul className="list">
                  {g.lines.map((l) => (
                    <li key={l.id} className={styles.line}>
                      {l.imageUrl ? (
                        <img className="thumb thumb--sm" src={l.imageUrl} alt="" referrerPolicy="no-referrer" />
                      ) : (
                        <span className="thumb thumb--sm" />
                      )}
                      <div className={styles.lineInfo}>
                        <span className={styles.lineTitle}>{l.title}</span>
                        <span className="xsmall muted num">
                          {l.variantName !== "Default" ? `${l.variantName}, ` : ""}Qty {l.quantity}
                        </span>
                      </div>
                      <span className="price num small">{formatPaise(l.unitPaise * l.quantity)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
        </div>

        <aside className={`panel ${styles.summary}`} aria-label="Payment summary">
          <div className="kv">
            <div>
              <span>Items</span>
              <span>{formatPaise(cart.subtotalPaise)}</span>
            </div>
            <div>
              <span>Shipping</span>
              <span>{cart.shippingPaise ? formatPaise(cart.shippingPaise) : "Free"}</span>
            </div>
            <div className="total">
              <span>To pay</span>
              <span>{formatPaise(cart.totalPaise)}</span>
            </div>
          </div>
          {addresses.length > 0 ? (
            <button form="place-order" className="btn btn--primary btn--block">
              Place order and pay
            </button>
          ) : (
            <p className="small muted">Add a delivery address to continue.</p>
          )}
          <p className="xsmall muted">
            Payments are in test mode. No money moves. <Link href="/cart">Back to cart</Link>
          </p>
        </aside>
      </div>
    </div>
  );
}
