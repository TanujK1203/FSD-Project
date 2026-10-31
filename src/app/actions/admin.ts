"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { requireRole } from "@/server/auth";

export async function setStoreStatus(formData: FormData) {
  await requireRole(["ADMIN"]);
  const id = String(formData.get("id"));
  const status = String(formData.get("status"));
  if (!["APPROVED", "REJECTED", "SUSPENDED", "PENDING"].includes(status)) return;
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 300);
  await db.store.update({
    where: { id },
    data: {
      status: status as "APPROVED" | "REJECTED" | "SUSPENDED" | "PENDING",
      rejectionReason: status === "REJECTED" ? reason || null : null,
      ...(status === "APPROVED" ? { approvedAt: new Date() } : {}),
    },
  });
  revalidatePath("/admin");
  revalidatePath("/");
}

export async function settlePayouts(formData: FormData) {
  await requireRole(["ADMIN"]);
  const ids = formData.getAll("ids").map(String);
  if (!ids.length) return;
  await db.payout.updateMany({ where: { id: { in: ids }, status: "READY" }, data: { status: "SETTLED", settledAt: new Date() } });
  revalidatePath("/admin/payouts");
}
