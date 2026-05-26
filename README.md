# PORTTRACK

SaaS multi-tenant de gestion de flotte et logistique portuaire pour les sous-traitants de transport du **Port Autonome d'Abidjan** (Côte d'Ivoire).

> Voir le cahier des charges complet : `../PORTTRACK_Cahier_des_Charges_6.docx`

## Stack technique

| Couche | Technologie |
| --- | --- |
| Monorepo | pnpm workspaces + Turborepo |
| Web | Next.js 15 (App Router) + TypeScript + Tailwind + shadcn/ui + next-intl |
| Mobile | Expo React Native (Phase 5) |
| Backend / DB | Supabase (PostgreSQL + RLS + Auth + Storage) |
| Bot WhatsApp | WhatsApp Business API (Phase 2) |
| Hébergement | Vercel (web) + Supabase Cloud |

## Architecture du monorepo

```
app/
├── apps/
│   ├── web/         # Next.js 15 — interface manager / dispatcher / comptable
│   └── mobile/      # Expo RN — app chauffeur terrain (Phase 5)
├── packages/
│   └── shared/      # Types Supabase, schémas Zod, utils communs
├── docs/            # Documentation interne (setup, conventions…)
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

## Démarrage rapide

```bash
# 1. Installer les dépendances
pnpm install

# 2. Configurer les variables d'environnement (voir docs/SETUP.md)
cp apps/web/.env.example apps/web/.env.local
# puis éditer apps/web/.env.local avec les clés Supabase

# 3. Lancer le serveur de développement
pnpm dev
```

L'application sera disponible sur http://localhost:3000.

## Scripts

- `pnpm dev` — démarre tous les apps en mode dev
- `pnpm build` — build de production de tous les apps
- `pnpm lint` — lint sur tout le monorepo
- `pnpm type-check` — vérification TypeScript sur tout le monorepo

## Prérequis

- Node.js ≥ 20
- pnpm ≥ 11
- Un projet Supabase (voir `docs/SETUP.md`)

## Documentation

- [Setup complet (Supabase, env, première connexion)](./docs/SETUP.md)
- Cahier des charges v1.4 (mai 2026)
