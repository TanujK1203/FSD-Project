import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth";
import { db } from "@/server/db";
import { StartSellingForm } from "@/components/StartSellingForm";
import { GoogleButton, OrDivider } from "@/components/GoogleButton";
import { googleConfigured } from "@/server/google";

export const metadata: Metadata = { title: "Start selling" };

export default async function StartPage() {
  const user = await getCurrentUser();
  if (user && (await db.store.findUnique({ where: { ownerId: user.id }, select: { id: true } }))) redirect("/sell/import");
  return (
    <div className="container" style={{ maxWidth: 480 }}>
      <div className="stack-lg">
        <div className="stack-sm">
          <p className="small muted">Step 1 of 3</p>
          <h1>Your store</h1>
        </div>
        {!user && googleConfigured() && (
          <div className="stack">
            <GoogleButton next="/sell/start" />
            <OrDivider />
          </div>
        )}
        <StartSellingForm signedIn={!!user} defaultName={user?.name} />
      </div>
    </div>
  );
}
