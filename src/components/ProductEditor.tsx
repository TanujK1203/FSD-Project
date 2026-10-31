"use client";

import { useActionState } from "react";
import { saveProduct, type SellerFormState } from "@/app/actions/seller";
import { CATEGORIES } from "@/lib/categories";

export type EditorProduct = {
  id: string;
  title: string;
  description: string;
  category: string;
  price: string;
  compareAt: string;
  optionName: string;
  options: string;
  stock: string;
  images: { id: string; url: string }[];
  sourceUrl: string | null;
};

export function ProductEditor({ product }: { product?: EditorProduct }) {
  const [state, action, pending] = useActionState<SellerFormState, FormData>(saveProduct, {});
  return (
    <form action={action} className="stack-lg" style={{ maxWidth: 720 }}>
      {product && <input type="hidden" name="id" value={product.id} />}

      <section className="panel form-grid form-grid--2">
        <label className="field span-2">
          <span>Name</span>
          <input className="input" name="title" required maxLength={140} defaultValue={product?.title} />
        </label>
        <label className="field">
          <span>Price (₹)</span>
          <input className="input num" name="price" inputMode="decimal" required defaultValue={product?.price} />
        </label>
        <label className="field">
          <span>
            Original price (₹) <span className="muted" style={{ fontWeight: 400 }}>(optional)</span>
          </span>
          <input className="input num" name="compareAt" inputMode="decimal" defaultValue={product?.compareAt} />
          <span className="hint">Shows a discount if higher than the price</span>
        </label>
        <label className="field span-2">
          <span>Category</span>
          <select className="select" name="category" defaultValue={product?.category ?? ""} required>
            <option value="" disabled>
              Choose a category
            </option>
            {CATEGORIES.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field span-2">
          <span>Description</span>
          <textarea className="textarea" name="description" defaultValue={product?.description} maxLength={5000} />
        </label>
      </section>

      <section className="panel stack">
        <h2 style={{ fontSize: "var(--fs-md)" }}>Photos</h2>
        {product && product.images.length > 0 && (
          <div className="row" style={{ gap: "var(--s3)" }}>
            {product.images.map((img) => (
              <label key={img.id} className="stack-sm" style={{ gap: 4, justifyItems: "center" }}>
                <img className="thumb" src={img.url} alt="" referrerPolicy="no-referrer" style={{ width: 80 }} />
                <span className="check xsmall">
                  <input type="checkbox" name="removeImage" value={img.id} /> Remove
                </span>
              </label>
            ))}
          </div>
        )}
        <label className="field">
          <span>Add photos</span>
          <input className="input" type="file" name="images" accept="image/jpeg,image/png,image/webp" multiple />
          <span className="hint">JPG, PNG or WebP, up to 8 MB each. Portrait photos look best.</span>
        </label>
      </section>

      <section className="panel form-grid form-grid--2">
        <h2 className="span-2" style={{ fontSize: "var(--fs-md)" }}>
          Options and stock
        </h2>
        <label className="field">
          <span>Option name</span>
          <input className="input" name="optionName" defaultValue={product?.optionName || "Size"} />
        </label>
        <label className="field">
          <span>
            Stock <span className="muted" style={{ fontWeight: 400 }}>(leave empty to not track)</span>
          </span>
          <input className="input num" name="stock" inputMode="numeric" defaultValue={product?.stock} />
        </label>
        <label className="field span-2">
          <span>
            Choices <span className="muted" style={{ fontWeight: 400 }}>(optional)</span>
          </span>
          <textarea
            className="textarea"
            name="options"
            style={{ minHeight: 80 }}
            placeholder={"One per line, e.g.\nS: 4\nM: 6\nL: 2"}
            defaultValue={product?.options}
          />
          <span className="hint">Add a number after a colon to set stock for that choice.</span>
        </label>
      </section>

      {!product && (
        <label className="check">
          <input type="checkbox" name="publish" defaultChecked /> Publish now
        </label>
      )}

      {state.error && (
        <p className="form-error" role="alert">
          {state.error}
        </p>
      )}
      <div className="row">
        <button className="btn btn--primary" disabled={pending}>
          {pending ? "Saving" : product ? "Save changes" : "Add product"}
        </button>
        {state.ok && <span className="small muted">{state.message}</span>}
        {product?.sourceUrl && (
          <a href={product.sourceUrl} target="_blank" rel="noopener noreferrer" className="small muted">
            View on your site
          </a>
        )}
      </div>
    </form>
  );
}
