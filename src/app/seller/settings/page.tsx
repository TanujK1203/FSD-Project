import type { Metadata } from "next";
import { requireSellerStore } from "@/server/auth";
import { StoreForm } from "@/components/StoreForm";
import { disconnectInstagram } from "@/app/actions/seller";

export const metadata: Metadata = { title: "Store details" };

export default async function Settings() {
  const { store } = await requireSellerStore("/seller/settings");
  return (
    <div className="stack-lg" style={{ maxWidth: 640 }}>
      <StoreForm
        store={{
          name: store.name,
          city: store.city ?? "",
          instagramHandle: store.instagramHandle ?? "",
          bio: store.bio ?? "",
          payoutUpi: store.payoutUpi ?? "",
          logoUrl: store.logoUrl,
        }}
      />
      <section className="panel stack-sm">
        <h2 style={{ fontSize: "var(--fs-md)" }}>Instagram</h2>
        {store.igToken ? (
          <div className="row row--between">
            <p className="small">
              Connected{store.instagramHandle ? ` as @${store.instagramHandle}` : ""}. We only read your posts.
            </p>
            <form action={disconnectInstagram}>
              <button className="btn btn--danger-text btn--sm">Disconnect</button>
            </form>
          </div>
        ) : (
          <p className="small muted">Not connected. You can connect it from the import page.</p>
        )}
      </section>
    </div>
  );
}
