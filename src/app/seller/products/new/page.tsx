import type { Metadata } from "next";
import Link from "next/link";
import { ProductEditor } from "@/components/ProductEditor";

export const metadata: Metadata = { title: "Add product" };

export default function NewProductPage() {
  return (
    <div className="stack">
      <Link href="/seller/products" className="small muted">
        Back to products
      </Link>
      <h2>Add a product</h2>
      <ProductEditor />
    </div>
  );
}
