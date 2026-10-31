import type { Metadata } from "next";
import Link from "next/link";
import { requireSellerStore } from "@/server/auth";
import { db } from "@/server/db";
import { ImportForm } from "@/components/ImportForm";
import { ImportProgress } from "@/components/ImportProgress";
import { instagramConfigured } from "@/server/instagram";

export const metadata: Metadata = { title: "Import products" };

export default async function ImportPage({ searchParams }: { searchParams: Promise<{ job?: string; ig?: string }> }) {
  const { store } = await requireSellerStore("/sell/import");
  const sp = await searchParams;
  const job = sp.job ? await db.importJob.findFirst({ where: { id: sp.job, storeId: store.id }, select: { id: true } }) : null;
  const igReady = instagramConfigured();

  return (
    <div className="container" style={{ maxWidth: 640 }}>
      <div className="stack-lg">
        <div className="stack-sm">
          <p className="small muted">Step 2 of 3</p>
          <h1>Bring in your products</h1>
          <p className="muted">Pick where your products are listed now. You can do both.</p>
        </div>

        {sp.ig === "error" && (
          <div className="notice notice--accent" role="alert">
            Instagram did not connect. Make sure it is a Business or Creator account, then try again.
          </div>
        )}

        {job && <ImportProgress jobId={job.id} />}

        <section className="panel option-card" aria-labelledby="web-h">
          <h2 id="web-h" style={{ fontSize: "var(--fs-md)" }}>
            From your website
          </h2>
          <p className="small muted">
            Shopify, WooCommerce, Dukaan, Instamojo, Wix or your own site. Paste the home page or shop page link.
          </p>
          <ImportForm defaultUrl={store.sourceType !== "INSTAGRAM" ? (store.sourceUrl ?? "") : ""} secondary={!!job} />
        </section>

        <section className="panel option-card" aria-labelledby="ig-h">
          <h2 id="ig-h" style={{ fontSize: "var(--fs-md)" }}>
            From Instagram
          </h2>
          <p className="small muted">
            Log in with your Instagram Business or Creator account. We read your posts (nothing is posted) and turn the
            ones with a price into drafts.
          </p>
          {store.igToken ? (
            <form action="/api/instagram/import" method="post">
              <button className="btn btn--secondary">Import from Instagram again</button>
            </form>
          ) : igReady ? (
            <a href="/api/instagram/connect" className="btn btn--secondary" style={{ justifySelf: "start" }}>
              Connect Instagram
            </a>
          ) : (
            <p className="small">
              <span className="badge">Coming soon</span>{" "}
              <span className="muted">Instagram connect is being set up. Use your website link or add products by hand.</span>
            </p>
          )}
        </section>

        <p className="small muted">
          No website?{" "}
          <Link href="/seller/products/new" className="strong" style={{ color: "var(--ink)" }}>
            Add products by hand
          </Link>
          {" "}or <Link href="/seller" className="strong" style={{ color: "var(--ink)" }}>go to your dashboard</Link>.
        </p>
      </div>
    </div>
  );
}
