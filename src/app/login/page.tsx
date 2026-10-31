import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { getCurrentUser } from "@/server/auth";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  if (await getCurrentUser()) redirect(next?.startsWith("/") ? next : "/account");
  return (
    <div className="container" style={{ maxWidth: 420 }}>
      <div className="stack-lg">
        <h1>Sign in</h1>
        <AuthForm mode="login" next={next} />
      </div>
    </div>
  );
}
