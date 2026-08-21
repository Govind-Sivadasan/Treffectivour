import { LoginForm } from "@/components/dashboard/today-panel";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect("/dashboard");

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
          Treffectivour
        </h1>
        <p className="text-[var(--color-muted)] mt-2">
          Smart effective hours from attendance screenshots
        </p>
      </div>
      <LoginForm />
    </div>
  );
}
