import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { GoogleButton, OrDivider } from "@/components/GoogleButton";
import { getCurrentUser } from "@/server/auth";
import { googleConfigured } from "@/server/google";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  if (await getCurrentUser()) redirect(next?.startsWith("/") ? next : "/account");
  const google = googleConfigured();
  return (
    <div className="container" style={{ maxWidth: 420 }}>
      <div className="stack-lg">
        <h1>Sign in</h1>
        {error === "google" && (
          <p className="notice notice--accent" role="alert">
            Google sign-in did not finish. Try again, or use your email and password.
          </p>
        )}
        {google && (
          <div className="stack">
            <GoogleButton next={next} />
            <OrDivider />
          </div>
        )}
        <AuthForm mode="login" next={next} />
      </div>
    </div>
  );
}
