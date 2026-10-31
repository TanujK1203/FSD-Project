import type { Metadata } from "next";
import Link from "next/link";
import { getCartView } from "@/server/cart";
import { formatPaise } from "@/lib/money";
import { COMMERCE } from "@/config";
import { removeItem, setQuantity } from "@/app/actions/cart";
import styles from "./cart.module.css";

export const metadata: Metadata = { title: "Cart" };

export default async function CartPage() {
  const cart = await getCartView();

  if (!cart.lines.length) {
    return (
      <div className="container">
        <div className="empty">
          <h1>Your cart is empty</h1>
          <p>Add things from any store. They all check out together.</p>
          <Link href="/" className="btn btn--secondary">
            Browse products
          </Link>
        </div>
      </div>
    );
  }

  const storeCount = cart.groups.length;

  return (
    <div className="container">
      <h1 style={{ marginBottom: "var(--s5)" }}>Cart</h1>
      <div className={styles.layout}>
        <div className="stack-lg">
          {cart.groups.map((g) => {
            const needed = COMMERCE.freeShippingThresholdPaise - g.subtotalPaise;
            return (
              <section key={g.storeId} className={styles.group} aria-label={`Items from ${g.storeName}`}>
                <header className={styles.groupHead}>
                  <Link href={`/s/${g.storeSlug}`} className="strong">
                    {g.storeName}
                  </Link>
                  <span className="small muted num">
                    {g.subtotalPaise > 0
                      ? g.shippingPaise === 0
                        ? "Free shipping"
                        : `Shipping ${formatPaise(g.shippingPaise)}`
                      : null}
                  </span>
                </header>
                <ul className="list">
                  {g.lines.map((l) => (
                    <li key={l.id} className={styles.line}>
                      <Link href={`/p/${l.productSlug}`} tabIndex={-1} aria-hidden="true">
                        {l.imageUrl ? (
                          <img className="thumb" src={l.imageUrl} alt="" referrerPolicy="no-referrer" />
                        ) : (
                          <span className="thumb" />
                        )}
                      </Link>
                      <div className={styles.lineInfo}>
                        <Link href={`/p/${l.productSlug}`} className={styles.lineTitle}>
                          {l.title}
                        </Link>
                        {l.variantName !== "Default" && <span className="small muted">{l.variantName}</span>}
                        {l.problem && <span className="badge badge--accent">{l.problem}</span>}
                        <div className={styles.lineActions}>
                          <div className={styles.stepper} aria-label="Quantity">
                            <form action={setQuantity}>
                              <input type="hidden" name="itemId" value={l.id} />
                              <input type="hidden" name="quantity" value={l.quantity - 1} />
                              <button aria-label={`Decrease quantity of ${l.title}`}>−</button>
                            </form>
                            <span className="num" aria-live="polite">
                              {l.quantity}
                            </span>
                            <form action={setQuantity}>
                              <input type="hidden" name="itemId" value={l.id} />
                              <input type="hidden" name="quantity" value={l.quantity + 1} />
                              <button aria-label={`Increase quantity of ${l.title}`} disabled={l.quantity >= l.maxQuantity}>
                                +
                              </button>
                            </form>
                          </div>
                          <form action={removeItem}>
                            <input type="hidden" name="itemId" value={l.id} />
                            <button className="btn btn--danger-text btn--sm">Remove</button>
                          </form>
                        </div>
                      </div>
                      <span className="price num">{formatPaise(l.unitPaise * l.quantity)}</span>
                    </li>
                  ))}
                </ul>
                {g.shippingPaise > 0 && needed > 0 && (
                  <p className={`xsmall muted ${styles.hint}`}>
                    Add {formatPaise(needed)} more from {g.storeName} for free shipping
                  </p>
                )}
              </section>
            );
          })}
        </div>

        <aside className={`panel ${styles.summary}`} aria-label="Order summary">
          <div className="kv">
            <div>
              <span>Items</span>
              <span>{formatPaise(cart.subtotalPaise)}</span>
            </div>
            <div>
              <span>
                Shipping{storeCount > 1 ? ` (${storeCount} stores)` : ""}
              </span>
              <span>{cart.shippingPaise ? formatPaise(cart.shippingPaise) : "Free"}</span>
            </div>
            <div className="total">
              <span>Total</span>
              <span>{formatPaise(cart.totalPaise)}</span>
            </div>
          </div>
          {cart.hasProblems && (
            <p className="small form-error">Remove items that are unavailable to continue.</p>
          )}
          <Link
            href="/checkout"
            className="btn btn--primary btn--block"
            aria-disabled={cart.hasProblems || cart.totalPaise === 0}
            style={cart.hasProblems ? { pointerEvents: "none" } : undefined}
          >
            Checkout
          </Link>
          {storeCount > 1 && (
            <p className="xsmall muted">
              One payment. Each store ships its own items, so you may get {storeCount} parcels.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
