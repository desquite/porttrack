import { use } from "react";
import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import { useTranslations } from "next-intl";
import { Anchor, FileSpreadsheet, Truck, ShieldCheck, Smartphone, Phone, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = use(params);
  setRequestLocale(locale);

  const t = useTranslations();

  const features = [
    { icon: FileSpreadsheet, key: "import" },
    { icon: Truck, key: "transport" },
    { icon: ShieldCheck, key: "fleet" },
    { icon: Smartphone, key: "driver" },
  ] as const;

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <Anchor className="size-6 text-primary" />
            <span className="text-lg font-semibold tracking-tight">
              {t("app.name")}
            </span>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href="/login">{t("home.login")}</Link>
          </Button>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-20 text-center">
        <h1 className="text-balance text-4xl font-bold tracking-tight md:text-5xl">
          {t("home.welcome")}
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-balance text-muted-foreground md:text-lg">
          {t("home.subtitle")}
        </p>
        <div className="mt-8 flex justify-center">
          <Button size="lg" asChild>
            <Link href="/login">{t("home.cta")}</Link>
          </Button>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {features.map(({ icon: Icon, key }) => (
            <Card key={key}>
              <CardHeader>
                <Icon className="mb-2 size-6 text-primary" />
                <CardTitle className="text-base">
                  {t(`home.features.${key}.title`)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>{t(`home.features.${key}.desc`)}</CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Contact */}
      <section className="border-t bg-muted/30">
        <div className="mx-auto max-w-6xl px-6 py-12 text-center">
          <h2 className="text-xl font-semibold tracking-tight">{t("contact.title")}</h2>
          <div className="mt-5 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-8">
            <a
              href={`tel:${t("contact.phoneHref")}`}
              className="inline-flex items-center gap-2 text-sm font-medium text-foreground hover:text-primary"
            >
              <Phone className="size-4 text-primary" />
              {t("contact.phone")}
            </a>
            <a
              href={`mailto:${t("contact.email")}`}
              className="inline-flex items-center gap-2 text-sm font-medium text-foreground hover:text-primary"
            >
              <Mail className="size-4 text-primary" />
              {t("contact.email")}
            </a>
          </div>
        </div>
      </section>

      <footer className="border-t">
        <div className="mx-auto max-w-6xl px-6 py-6 text-center text-xs text-muted-foreground">
          {t("app.footer")}
        </div>
      </footer>
    </main>
  );
}
