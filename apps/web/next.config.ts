import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      // 10 MB pour matcher la limite du bucket Supabase Storage (PDFs scans
      // de permis, cartes grises, etc.). Par défaut Next limite à 1 MB.
      bodySizeLimit: "10mb",
    },
  },
};

export default withNextIntl(nextConfig);
