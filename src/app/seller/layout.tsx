import { requireSellerStore } from "@/server/auth";
import { SubNav } from "@/components/SubNav";

export default async function SellerLayout({ children }: { children: React.ReactNode }) {
  const { store } = await requireSellerStore("/seller");
  return (
    <div className="container">
      <div className="row row--between" style={{ marginBottom: "var(--s3)" }}>
        <h1 style={{ fontSize: "var(--fs-lg)" }}>{store.name}</h1>
        {store.status === "APPROVED" && (
          <a href={`/s/${store.slug}`} className="small muted">
            View your store
          </a>
        )}
      </div>
      <SubNav
        label="Store sections"
        items={[
          { href: "/seller", label: "Overview", exact: true },
          { href: "/seller/products", label: "Products" },
          { href: "/seller/orders", label: "Orders" },
          { href: "/seller/payouts", label: "Payouts" },
          { href: "/seller/settings", label: "Store details" },
        ]}
      />
      {children}
    </div>
  );
}
