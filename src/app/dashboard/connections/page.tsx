import { redirect } from "next/navigation";

export default function LegacyConnectionsRedirectPage() {
  redirect("/dashboard/settings");
}
