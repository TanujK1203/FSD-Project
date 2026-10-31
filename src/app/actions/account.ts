"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/server/db";
import { requireUser } from "@/server/auth";
import { STATES } from "@/lib/india";
import { safeNext } from "@/lib/nav";

export type AddressState = { error?: string; ok?: boolean };

const addressSchema = z.object({
  name: z.string().trim().min(2, "Enter the recipient's name").max(80),
  phone: z
    .string()
    .transform((s) => s.replace(/[\s-]/g, "").replace(/^\+?91/, ""))
    .pipe(z.string().regex(/^[6-9]\d{9}$/, "Enter a 10 digit mobile number")),
  line1: z.string().trim().min(4, "Enter the house and street").max(160),
  line2: z.string().trim().max(160).optional(),
  city: z.string().trim().min(2, "Enter the city").max(60),
  state: z.string().refine((s) => STATES.includes(s), "Choose a state"),
  pincode: z.string().trim().regex(/^[1-9]\d{5}$/, "Enter a 6 digit PIN code"),
});

export async function saveAddress(_prev: AddressState, formData: FormData): Promise<AddressState> {
  const user = await requireUser();
  const parsed = addressSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const count = await db.address.count({ where: { userId: user.id } });
  const makeDefault = formData.get("isDefault") === "on" || count === 0;
  if (makeDefault) await db.address.updateMany({ where: { userId: user.id }, data: { isDefault: false } });
  await db.address.create({
    data: { ...parsed.data, line2: parsed.data.line2 || null, userId: user.id, isDefault: makeDefault },
  });
  revalidatePath("/checkout");
  revalidatePath("/account");
  const next = formData.get("next");
  if (next) redirect(safeNext(next));
  return { ok: true };
}

export async function deleteAddress(formData: FormData) {
  const user = await requireUser();
  await db.address.deleteMany({ where: { id: String(formData.get("id")), userId: user.id } });
  revalidatePath("/account");
}

export async function setDefaultAddress(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id"));
  const owned = await db.address.findFirst({ where: { id, userId: user.id } });
  if (!owned) return;
  await db.address.updateMany({ where: { userId: user.id }, data: { isDefault: false } });
  await db.address.update({ where: { id }, data: { isDefault: true } });
  revalidatePath("/account");
}

export async function updateProfile(_prev: AddressState, formData: FormData): Promise<AddressState> {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").replace(/[\s-]/g, "");
  if (name.length < 2) return { error: "Enter your name" };
  if (phone && !/^(\+?91)?[6-9]\d{9}$/.test(phone)) return { error: "Enter a 10 digit mobile number" };
  await db.user.update({ where: { id: user.id }, data: { name, phone: phone || null } });
  revalidatePath("/account");
  return { ok: true };
}
