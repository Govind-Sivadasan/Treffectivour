import { DashboardApp } from "@/components/dashboard/dashboard-app";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return <DashboardApp user={session} />;
}
