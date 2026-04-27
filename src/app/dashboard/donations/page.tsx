import { redirect } from "next/navigation";

export default function DonationsIndexPage() {
  redirect("/dashboard/donations/alerts");
}

