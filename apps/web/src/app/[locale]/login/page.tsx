import { setRequestLocale } from "next-intl/server";
import { useTranslations } from "next-intl";
import { Suspense, use } from "react";
import { Phone, Mail } from "lucide-react";
import { LoginForm } from "./login-form";

export default function LoginPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = use(params);
  setRequestLocale(locale);
  const t = useTranslations();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-muted/30 px-4 py-10">
      {/* Suspense boundary requise : LoginForm utilise useSearchParams()
          (pour le bypass /login?step=code&email=...) — sans ce wrapper,
          Next.js refuse de pré-rendre la page côté serveur. */}
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>

      {/* Contact PORTTRACK — pour un visiteur qui veut nous joindre */}
      <div className="text-center text-sm text-muted-foreground">
        <p className="mb-2">{t("contact.title")}</p>
        <div className="flex flex-col items-center justify-center gap-2 sm:flex-row sm:gap-6">
          <a
            href={`tel:${t("contact.phoneHref")}`}
            className="inline-flex items-center gap-2 font-medium text-foreground hover:text-primary"
          >
            <Phone className="size-4 text-primary" />
            {t("contact.phone")}
          </a>
          <a
            href={`mailto:${t("contact.email")}`}
            className="inline-flex items-center gap-2 font-medium text-foreground hover:text-primary"
          >
            <Mail className="size-4 text-primary" />
            {t("contact.email")}
          </a>
        </div>
      </div>
    </main>
  );
}
