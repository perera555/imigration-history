import { Suspense } from "react";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getSession } from "@/lib/session";
import { RegisterForm } from "./RegisterForm";

export const metadata: Metadata = { title: "Create account" };

export default function RegisterPage() {
  return (
    <Suspense>
      <Register />
    </Suspense>
  );
}

async function Register() {
  // Already signed in: go straight to the travel card & record forms.
  const session = await getSession().catch(() => null);
  if (session) redirect(session.role === "admin" ? "/admin" : "/account");
  return <RegisterForm />;
}
