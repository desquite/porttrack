import { setRequestLocale } from "next-intl/server";
import { Suspense, use } from "react";
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
      {/* Suspense boundary requise : LoginForm utilise useSearchParams()
          (pour le bypass /login?step=code&email=...) — sans ce wrapper,
          Next.js refuse de pré-rendre la page côté serveur. */}
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
