import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // PGlite (the embedded Postgres used when DATABASE_URL is unset) and react-pdf run on the server only.
  serverExternalPackages: ["@electric-sql/pglite", "@react-pdf/renderer"],
  // Ship the SQL migrations with every server function so /api/setup and the embedded fallback can migrate.
  outputFileTracingIncludes: {
    "/**": ["./drizzle/**/*"],
  },
  images: { remotePatterns: [{ protocol: "https", hostname: "*.public.blob.vercel-storage.com" }] },
};

export default nextConfig;
