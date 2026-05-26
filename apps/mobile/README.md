# PORTTRACK — App mobile (Phase 5)

Cet emplacement est réservé à l'application mobile **Expo React Native** prévue en **Phase 5** du cahier des charges (semaines 19-20 du MVP).

## À faire au démarrage de la Phase 5

```bash
cd app
pnpm create expo apps/mobile --template default --yes
cd apps/mobile
# Installer Supabase et le package partagé
pnpm add @supabase/supabase-js @react-native-async-storage/async-storage @porttrack/shared@workspace:*
```

## Fonctionnalités cibles (cahier §12 et §5.3)

- Confirmation de livraison sur le terrain par le chauffeur
- Capture de l'EIR via la caméra du smartphone
- Réception des notifications de mission
- Consultation rapide de la fiche d'un conteneur affecté
- Mode dégradé pour connexion faible (cache local + sync différée)

## Conventions partagées avec le web

- Authentification : Supabase Auth (OTP par téléphone)
- Types : `@porttrack/shared` (workspace package)
- Schémas Zod : `@porttrack/shared/schemas`
- Multi-tenant : `tenant_id` injecté via JWT, RLS PostgreSQL côté serveur
