import { redirect } from "next/navigation";

export default function LegacySetupRedirectPage() {
  redirect("/dashboard/tiktok/setup-parser");
}

