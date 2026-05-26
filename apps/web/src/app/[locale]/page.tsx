import { use } from "react";
import { setRequestLocale } from "next-intl/server";
import { useTranslations } from "next-intl";
import { Anchor, FileSpreadsheet, Bell, Receipt } from "lucide-react";
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
    { icon: Anchor, key: "fleet" },
    { icon: Bell, key: "alerts" },
    { icon: Receipt, key: "billing" },
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
            <a href="/login">{t("auth.login.submit")}</a>
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
            <a href="/login">{t("home.cta")}</a>
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
                  {t(`home.features.${key}`)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>{t("app.tagline")}</CardDescription>
              </CardContent>
            </Card>
          ))}
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
