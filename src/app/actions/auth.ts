"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/server/db";
import { createSession, destroySession, hashPassword, verifyPassword } from "@/server/auth";
import { mergeGuestCart } from "@/server/cart";
import { safeNext } from "@/lib/nav";

export type FormState = { error?: string; fields?: Record<string, string> };

const signupSchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(80),
  email: z.email("Enter a valid email").transform((e) => e.toLowerCase()),
  password: z.string().min(8, "Use at least 8 characters").max(200),
});

export async function signup(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = Object.fromEntries(["name", "email", "password"].map((k) => [k, String(formData.get(k) ?? "")]));
  const parsed = signupSchema.safeParse(raw);
  const fields = { name: raw.name!, email: raw.email! };
  if (!parsed.success) return { error: parsed.error.issues[0]?.message, fields };

  const exists = await db.user.findUnique({ where: { email: parsed.data.email } });
  if (exists) return { error: "An account with this email already exists. Sign in instead.", fields };

  const user = await db.user.create({
    data: { name: parsed.data.name, email: parsed.data.email, passwordHash: await hashPassword(parsed.data.password) },
  });
  await createSession(user.id);
  await mergeGuestCart(user.id);
  redirect(safeNext(formData.get("next")));
}

export async function login(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const user = await db.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return { error: "Email or password is incorrect", fields: { email } };
  }
  await createSession(user.id);
  await mergeGuestCart(user.id);
  const fallback = user.role === "ADMIN" ? "/admin" : user.role === "SELLER" ? "/seller" : "/";
  redirect(safeNext(formData.get("next"), fallback));
}

export async function logout() {
  await destroySession();
  redirect("/");
}
