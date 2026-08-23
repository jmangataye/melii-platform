import { redirect } from "next/navigation";
import { getCurrentCreatorId, isAdminEmail } from "@/lib/auth";
import { getCreatorById } from "@melii/db";
import AdminApp from "./AdminApp";

export default async function AdminPage() {
  const creatorId = await getCurrentCreatorId();
  if (!creatorId) redirect("/login");

  const creator = await getCreatorById(creatorId);
  if (!creator || !isAdminEmail(creator.email)) redirect("/dashboard");

  return <AdminApp />;
}
