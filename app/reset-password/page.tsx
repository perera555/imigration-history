import { Suspense } from "react";
import type { Metadata } from "next";
import { AuthCard } from "@/components/AuthCard";
import { ResetForm } from "./ResetForm";

export const metadata: Metadata = { title: "Reset password" };

export default function ResetPasswordPage() {
  return (
    <AuthCard eyebrow="Account recovery" title="New password" subtitle="Choose a new password (at least 8 characters).">
      <Suspense>
        <ResetForm />
      </Suspense>
    </AuthCard>
  );
}
