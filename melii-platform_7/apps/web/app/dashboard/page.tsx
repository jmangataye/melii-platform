import { redirect } from "next/navigation";
import { getCurrentCreatorId } from "@/lib/auth";
import { getCreatorById } from "@melii/db";
import DashboardApp from "./DashboardApp";

export default async function DashboardPage() {
  const creatorId = await getCurrentCreatorId();
  if (!creatorId) redirect("/login");

  const creator = await getCreatorById(creatorId);
  if (!creator) redirect("/login");

  return <DashboardApp initialDisplayName={creator.displayName} />;
}
