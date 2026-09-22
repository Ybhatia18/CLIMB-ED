import { redirect } from "next/navigation";

import ProfileForm from "@/components/ProfileForm";
import { getCurrentUser } from "@/lib/auth";

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="flex flex-1 flex-col items-center gap-8 bg-zinc-50 px-6 py-16 dark:bg-black">
      <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
        Your profile
      </h1>
      <ProfileForm user={user} />
    </div>
  );
}
