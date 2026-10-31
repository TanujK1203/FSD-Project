import type { Metadata } from "next";
import Link from "next/link";
import { SITE, COMMERCE } from "@/config";
import { getCurrentUser } from "@/server/auth";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "Sell with us" };

export default async function SellPage() {
  const user = await getCurrentUser();
  const store = user ? await db.store.findUnique({ where: { ownerId: user.id }, select: { id: true } }) : null;

  return (
    <div className="container container--narrow stack-lg">
      <div className="stack">
        <h1>Bring your store to {SITE.name}</h1>
        <p className="muted" style={{ fontSize: "var(--fs-md)", maxWidth: "56ch" }}>
          You already have products listed on your website or Instagram. Give us the link and we copy them over for you.
          You check the details, then buyers can add your items to the same cart as other small stores.
        </p>
        <div className="row">
          <Link href={store ? "/sell/import" : "/sell/start"} className="btn btn--primary">
            {store ? "Import products" : "Start selling"}
          </Link>
          {!user && (
            <Link href="/login?next=/sell/start" className="btn btn--ghost">
              I have an account
            </Link>
          )}
        </div>
      </div>

      <section className="panel stack" aria-labelledby="how-h">
        <h2 id="how-h">How it works</h2>
        <ol className="steps">
          <li>
            <div>
              <strong>Tell us your store name</strong>
              <p>Takes a minute. No documents needed to start.</p>
            </div>
          </li>
          <li>
            <div>
              <strong>Paste your store link or connect Instagram</strong>
              <p>
                Works with Shopify, WooCommerce, Dukaan, Instamojo, Wix and most other shop websites. With Instagram, we
                read your own posts and turn the ones with a price into products.
              </p>
            </div>
          </li>
          <li>
            <div>
              <strong>Check the drafts and publish</strong>
              <p>Fix any price or name we got wrong. Nothing goes live until you publish it.</p>
            </div>
          </li>
          <li>
            <div>
              <strong>We approve your store once</strong>
              <p>After that, everything you publish shows up for buyers right away.</p>
            </div>
          </li>
        </ol>
      </section>

      <section className="stack-sm" aria-labelledby="fees-h">
        <h2 id="fees-h">What it costs</h2>
        <p className="muted small" style={{ maxWidth: "60ch" }}>
          No listing fee. We keep {Math.round(COMMERCE.commissionRate * 100)}% of each item sale. You ship your own
          orders and get paid out after delivery. Prices and stock keep in sync with your website every day.
        </p>
      </section>
    </div>
  );
}
