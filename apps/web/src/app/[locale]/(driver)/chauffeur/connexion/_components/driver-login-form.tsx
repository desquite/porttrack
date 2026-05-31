"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Phone, KeyRound, ArrowRight, ArrowLeft } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

/** Convertit un numéro CI saisi librement en E.164 (+225…). */
function toE164(raw: string): string {
  const d = raw.replace(/\D/g, "");
  if (d.startsWith("225")) return "+" + d;
  return "+225" + d.replace(/^0+/, "");
}

export function DriverLoginForm() {
  const router = useRouter();
  const supabase = createClient();
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function requestCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const e164 = toE164(phone);
    const { error } = await supabase.auth.signInWithOtp({ phone: e164 });
    setPending(false);
    if (error) {
      setError(error.message.includes("not recognized") ? "Numéro non reconnu." : `Erreur : ${error.message}`);
      return;
    }
    setStep("otp");
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const e164 = toE164(phone);
    const { error } = await supabase.auth.verifyOtp({ phone: e164, token: code.trim(), type: "sms" });
    setPending(false);
    if (error) {
      setError("Code incorrect ou expiré.");
      return;
    }
    router.replace("/chauffeur");
    router.refresh();
  }

  return (
    <div className="space-y-5">
      {error && (
        <Alert variant="destructive">
          <AlertTitle>Connexion impossible</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {step === "phone" ? (
        <form onSubmit={requestCode} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="phone" className="text-sm">Ton numéro de téléphone</Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="phone"
                type="tel"
                inputMode="tel"
                required
                autoFocus
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="07 09 64 60 96"
                className="h-12 pl-9 text-base"
              />
            </div>
            <p className="text-xs text-muted-foreground">Tu recevras un code par WhatsApp.</p>
          </div>
          <Button type="submit" disabled={pending || phone.replace(/\D/g, "").length < 8} className="h-12 w-full text-base">
            {pending ? <><Loader2 className="mr-2 size-5 animate-spin" />Envoi…</> : <>Recevoir mon code<ArrowRight className="ml-2 size-5" /></>}
          </Button>
        </form>
      ) : (
        <form onSubmit={verifyCode} className="space-y-4">
          <button type="button" onClick={() => { setStep("phone"); setCode(""); setError(null); }} className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <ArrowLeft className="size-3" />Changer de numéro
          </button>
          <div className="space-y-1.5">
            <Label htmlFor="code" className="text-sm">Code reçu par WhatsApp</Label>
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="123456"
                className="h-12 pl-9 text-center text-lg tracking-[0.3em]"
              />
            </div>
            <p className="text-xs text-muted-foreground">Envoyé au {phone}.</p>
          </div>
          <Button type="submit" disabled={pending || code.trim().length < 4} className="h-12 w-full text-base">
            {pending ? <><Loader2 className="mr-2 size-5 animate-spin" />Vérification…</> : <>Me connecter<ArrowRight className="ml-2 size-5" /></>}
          </Button>
        </form>
      )}
    </div>
  );
}
