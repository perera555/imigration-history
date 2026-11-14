import { redirect } from "next/navigation";

// The all-in-one form (travel card + countries & visits, optional document upload) lives at /admin/import.
export default function NewProfilePage() {
  redirect("/admin/import");
}
