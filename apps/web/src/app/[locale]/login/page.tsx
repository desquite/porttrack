import { setRequestLocale } from "next-intl/server";
import { use } from "react";
import { LoginForm } from "./login-form";

export default function LoginPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = use(params);
  setRequestLocale(locale);

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-10">
      <LoginForm />
    </main>
  );
}
