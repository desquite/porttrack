# Setup PORTTRACK

Guide pas-à-pas pour configurer un environnement de développement local.

## 1. Prérequis

| Outil | Version min | Vérification |
| --- | --- | --- |
| Node.js | 20+ | `node --version` |
| pnpm | 11+ | `pnpm --version` |
| Git | 2.40+ | `git --version` |

Si `pnpm` n'est pas installé :

```bash
npm install -g pnpm
```

## 2. Installation des dépendances

Depuis la racine du monorepo (`app/`) :

```bash
pnpm install
```

Toutes les apps et tous les packages s'installent en une seule commande.

## 3. Créer un projet Supabase

1. Se rendre sur [supabase.com](https://supabase.com) et créer un compte (gratuit).
2. Cliquer sur **New Project**.
3. Renseigner :
   - **Name** : `porttrack-dev` (ou `porttrack-prod` pour la prod)
   - **Database password** : générer un mot de passe fort et le stocker dans un gestionnaire de mots de passe
   - **Region** : **Frankfurt (eu-central-1)** — meilleure latence depuis Abidjan via l'Europe
   - **Pricing plan** : Free tier suffit pour démarrer
4. Attendre 2-3 minutes que le projet soit provisionné.
5. Une fois le projet prêt, aller dans **Project Settings → API** et récupérer :
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** → `SUPABASE_SERVICE_ROLE_KEY` (⚠️ NE JAMAIS exposer côté client)

## 4. Configurer les variables d'environnement

```bash
cp apps/web/.env.example apps/web/.env.local
```

Éditer `apps/web/.env.local` et remplir au minimum :

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
```

Les autres variables (WhatsApp, SendGrid, SMS) peuvent rester vides jusqu'à la Phase 2.

## 5. Lancer le serveur de développement

```bash
pnpm dev
```

Ouvre `apps/web` sur **http://localhost:3000**.

## 6. Régénérer les types Supabase (après chaque migration)

Une fois le schéma de base de données défini, lancer :

```bash
pnpm dlx supabase gen types typescript \
  --project-id <project-ref> \
  > packages/shared/src/database.types.ts
```

> `<project-ref>` se trouve dans l'URL Supabase : `https://<project-ref>.supabase.co`

## 7. Architecture multi-tenant — rappels critiques

- **Toute table métier doit avoir une colonne `tenant_id NOT NULL`** (cahier §2.1).
- **Toute table métier doit avoir une RLS policy** filtrant par `tenant_id = auth.jwt() ->> 'tenant_id'`.
- **Vérifier en double dans les Server Actions** : pas confier l'isolation à la seule RLS.
- Le `tenant_id` est injecté dans le JWT au moment de la connexion via un trigger Supabase Auth.

## Dépannage

- **Erreur `Module not found: @porttrack/shared`** : lancer `pnpm install` à la racine.
- **Page blanche avec erreur de session** : vérifier que `.env.local` contient bien les clés Supabase.
- **Le middleware boucle** : vérifier que le matcher du middleware exclut bien `/_next` et `/api`.
