import { Suspense } from "react";
import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";
import { AuthCard } from "@/components/AuthCard";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <AuthCard eyebrow="Admin panel" title="Admin sign in" subtitle="Sign in to add and update immigration records.">
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthCard>
  );
}
