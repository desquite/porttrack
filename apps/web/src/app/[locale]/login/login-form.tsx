"use client";

import { useActionState, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Anchor, Loader2, Mail, KeyRound, ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  requestOtpAction,
  verifyOtpAction,
  type LoginState,
} from "./actions";

const initialState: LoginState = { status: "idle" };

export function LoginForm() {
  const t = useTranslations("auth.login");
  const tContact = useTranslations("contact");
  const searchParams = useSearchParams();
  const [requestState, requestSubmit, requestPending] = useActionState(
    requestOtpAction,
    initialState,
  );
  const [verifyState, verifySubmit, verifyPending] = useActionState(
    verifyOtpAction,
    initialState,
  );
  const [isPending, startTransition] = useTransition();
  const [method, setMethod] = useState<"code" | "link">("code");

  // Dev bypass: ?step=code&email=... permet d'arriver direct à la saisie
  // du code (utile quand on a généré un OTP via le script admin pour
  // contourner la rate limit SMTP de Supabase pendant les tests).
  const bypassStep = searchParams.get("step");
  const bypassEmail = searchParams.get("email");
  const isBypassCode = bypassStep === "code" && !!bypassEmail;

  // The "current state" is whichever was most recently updated.
  const state: LoginState =
    verifyState.status !== "idle"
      ? verifyState
      : requestState.status !== "idle"
        ? requestState
        : isBypassCode
          ? { status: "sent", method: "code", email: bypassEmail! }
          : { status: "idle" };

  const showCodeStep =
    state.status === "sent" && state.method === "code";
  const showLinkSentMessage =
    state.status === "sent" && state.method === "link";

  function handleResend() {
    if (!state.email) return;
    startTransition(() => {
      const fd = new FormData();
      fd.set("email", state.email!);
      fd.set("method", state.method ?? "code");
      requestSubmit(fd);
    });
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 flex size-10 items-center justify-center rounded-full bg-primary/10">
          <Anchor className="size-5 text-primary" />
        </div>
        <CardTitle className="text-xl">{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>

      <CardContent>
        {/* Erreur globale */}
        {state.status === "error" && state.error && (
          <Alert variant="destructive" className="mb-4">
            <AlertTitle>{t("errorTitle")}</AlertTitle>
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        )}

        {/* État : lien envoyé — message d'attente */}
        {showLinkSentMessage && (
          <div className="space-y-4">
            <Alert variant="info">
              <AlertTitle>{t("linkSentTitle")}</AlertTitle>
              <AlertDescription>
                {t("linkSentDescription", { email: state.email ?? "" })}
              </AlertDescription>
            </Alert>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => {
                // Repart à l'étape 1 — on re-soumet avec un email vide pour reset
                window.location.reload();
              }}
            >
              <ArrowLeft className="mr-2 size-4" />
              {t("back")}
            </Button>
          </div>
        )}

        {/* État : étape 2 — saisie du code */}
        {showCodeStep && !showLinkSentMessage && (
          <form action={verifySubmit} className="space-y-4">
            <Alert variant="info">
              <AlertTitle>{t("codeSentTitle")}</AlertTitle>
              <AlertDescription>
                {t("codeSentDescription", { email: state.email ?? "" })}
              </AlertDescription>
            </Alert>

            <input type="hidden" name="email" value={state.email ?? ""} />

            <div className="space-y-2">
              <Label htmlFor="token">{t("codeLabel")}</Label>
              <Input
                id="token"
                name="token"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={10}
                autoComplete="one-time-code"
                placeholder="12345678"
                required
                autoFocus
                className="text-center text-2xl tracking-widest font-mono"
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={verifyPending}
            >
              {verifyPending ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  {t("verifying")}
                </>
              ) : (
                <>
                  <KeyRound className="mr-2 size-4" />
                  {t("verifyCta")}
                </>
              )}
            </Button>

            <div className="flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="text-muted-foreground underline-offset-4 hover:underline"
              >
                {t("changeEmail")}
              </button>
              <button
                type="button"
                onClick={handleResend}
                disabled={isPending || requestPending}
                className="text-primary underline-offset-4 hover:underline disabled:opacity-50"
              >
                {isPending || requestPending ? t("resending") : t("resend")}
              </button>
            </div>
          </form>
        )}

        {/* État : étape 1 — saisie email + choix méthode */}
        {!showCodeStep && !showLinkSentMessage && (
          <form action={requestSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t("email")}</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="nom@exemple.com"
                autoComplete="email"
                required
                defaultValue={state.email ?? ""}
              />
            </div>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">
                {t("methodLabel")}
              </legend>
              <div className="grid grid-cols-2 gap-2">
                <MethodOption
                  id="method-code"
                  checked={method === "code"}
                  onChange={() => setMethod("code")}
                  icon={<KeyRound className="size-4" />}
                  label={t("methodCode")}
                  hint={t("methodCodeHint")}
                />
                <MethodOption
                  id="method-link"
                  checked={method === "link"}
                  onChange={() => setMethod("link")}
                  icon={<Mail className="size-4" />}
                  label={t("methodLink")}
                  hint={t("methodLinkHint")}
                />
              </div>
              <input type="hidden" name="method" value={method} />
            </fieldset>

            <Button
              type="submit"
              className="w-full"
              disabled={requestPending}
            >
              {requestPending ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  {t("sending")}
                </>
              ) : (
                t("submit")
              )}
            </Button>
          </form>
        )}
      </CardContent>

      <CardFooter className="text-center text-xs text-muted-foreground">
        <p className="w-full">
          {t("noAccount")}{" "}
          <a
            href={`mailto:${tContact("email")}`}
            className="font-medium text-primary hover:underline"
          >
            {t("contactUs")}
          </a>
        </p>
      </CardFooter>
    </Card>
  );
}

function MethodOption(props: {
  id: string;
  checked: boolean;
  onChange: () => void;
  icon: React.ReactNode;
  label: string;
  hint: string;
}) {
  return (
    <label
      htmlFor={props.id}
      className={cn(
        "flex cursor-pointer flex-col gap-1 rounded-md border p-3 transition-colors",
        props.checked
          ? "border-primary bg-primary/5"
          : "border-input hover:bg-accent",
      )}
    >
      <input
        id={props.id}
        type="radio"
        name="method-radio"
        checked={props.checked}
        onChange={props.onChange}
        className="sr-only"
      />
      <div className="flex items-center gap-2 text-sm font-medium">
        {props.icon}
        {props.label}
      </div>
      <span className="text-xs text-muted-foreground">{props.hint}</span>
    </label>
  );
}
