import { redirect } from "next/navigation";

export default function LegacyWidgetsRedirectPage() {
  redirect("/dashboard/donations/widget-links");
}

