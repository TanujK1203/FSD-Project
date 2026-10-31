import { requireRole } from "@/server/auth";
import { SubNav } from "@/components/SubNav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireRole(["ADMIN"], "/admin");
  return (
    <div className="container">
      <h1 style={{ fontSize: "var(--fs-lg)", marginBottom: "var(--s3)" }}>Admin</h1>
      <SubNav
        label="Admin sections"
        items={[
          { href: "/admin", label: "Stores", exact: true },
          { href: "/admin/imports", label: "Imports" },
          { href: "/admin/orders", label: "Orders" },
          { href: "/admin/payouts", label: "Payouts" },
          { href: "/admin/users", label: "Users" },
        ]}
      />
      {children}
    </div>
  );
}
