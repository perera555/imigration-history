import { Suspense } from "react";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getSession } from "@/lib/session";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <Suspense>
      <Login />
    </Suspense>
  );
}

async function Login() {
  // Already signed in: go straight to the right place.
  const session = await getSession().catch(() => null);
  if (session) redirect(session.role === "admin" ? "/admin" : "/account");
  return <LoginForm />;
}
