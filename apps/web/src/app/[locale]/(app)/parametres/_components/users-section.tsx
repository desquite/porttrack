import { Users, AlertTriangle, CheckCircle2 } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { Database } from "@porttrack/shared";
import { InviteUserForm } from "./invite-user-form";
import { UserRow } from "./user-row";

type UserRecord = Database["public"]["Tables"]["users"]["Row"];

type Props = {
  tenantId: string;
  /** ID du caller — pour marquer "Toi" et désactiver les self-actions */
  currentUserId: string;
  /** Message flash propagé via ?userMsg=… */
  userMsg?: string;
  userMsgType?: "success" | "error";
};

export async function UsersSection({
  tenantId,
  currentUserId,
  userMsg,
  userMsgType,
}: Props) {
  const supabase = await createClient();

  const { data: users, error } = await supabase
    .from("users")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: true });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="size-4 text-primary" />
          Membres ({users?.length ?? 0})
        </CardTitle>
        <CardDescription>
          Invite tes dispatchers, comptables et chefs de garage. Chaque membre
          aura accès à PORTTRACK avec son propre identifiant et son rôle dédié.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Flash propagé par les actions update/toggle */}
        {userMsg && (
          <Alert
            variant={userMsgType === "error" ? "destructive" : "default"}
            className={
              userMsgType === "success"
                ? "border-emerald-300 bg-emerald-50/60 text-emerald-900"
                : undefined
            }
          >
            {userMsgType === "error" ? (
              <AlertTriangle className="size-4" />
            ) : (
              <CheckCircle2 className="size-4" />
            )}
            <AlertTitle>
              {userMsgType === "error" ? "Erreur" : "Action effectuée"}
            </AlertTitle>
            <AlertDescription>{userMsg}</AlertDescription>
          </Alert>
        )}

        {/* Erreur de chargement */}
        {error && (
          <Alert variant="destructive">
            <AlertTitle>Erreur de chargement</AlertTitle>
            <AlertDescription>{error.message}</AlertDescription>
          </Alert>
        )}

        {/* Liste des membres */}
        {users && users.length > 0 ? (
          <ul className="space-y-2">
            {users.map((u: UserRecord) => (
              <UserRow
                key={u.id}
                userId={u.id}
                email={u.email}
                role={u.role}
                actif={u.actif}
                tenantId={tenantId}
                isSelf={u.id === currentUserId}
                createdAt={u.created_at}
              />
            ))}
          </ul>
        ) : (
          <div className="rounded-md border border-dashed bg-muted/20 p-6 text-center text-sm text-muted-foreground">
            Aucun membre pour le moment. Invite ton premier collaborateur via
            le formulaire ci-dessous.
          </div>
        )}

        {/* Formulaire d'invitation */}
        <div className="border-t pt-6">
          <h4 className="mb-3 text-sm font-semibold tracking-tight">
            Inviter un nouveau membre
          </h4>
          <InviteUserForm tenantId={tenantId} />
        </div>
      </CardContent>
    </Card>
  );
}
