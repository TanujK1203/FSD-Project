import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { getCurrentUser } from "@/server/auth";

export const metadata: Metadata = { title: "Create account" };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  if (await getCurrentUser()) redirect(next?.startsWith("/") ? next : "/account");
  return (
    <div className="container" style={{ maxWidth: 420 }}>
      <div className="stack-lg">
        <div className="stack-sm">
          <h1>Create account</h1>
          <p className="muted">One account for every store here. Your cart comes with you.</p>
        </div>
        <AuthForm mode="signup" next={next} />
      </div>
    </div>
  );
}
