import { redirect } from "next/navigation";

export default function LegacyFakeDonationsRedirectPage() {
  redirect("/dashboard/donations/battle");
}

