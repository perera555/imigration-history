import type { NextConfig } from "next";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const pkg = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as { version: string };

// Version of this build: package version + commit (Vercel) or build time. The app compares it
// with the live version and offers "Update now" when a new version is published.
const commit = (process.env.VERCEL_GIT_COMMIT_SHA ?? "").slice(0, 7);
// Must be the same everywhere the config is loaded (server and browser bundles), so no timestamps.
const APP_VERSION = `${pkg.version}+${commit || "local"}`;

const nextConfig: NextConfig = {
  env: { NEXT_PUBLIC_APP_VERSION: APP_VERSION },
  experimental: {
    agentFeedback: true,
    serverActions: {
      bodySizeLimit: "12mb", // resized profile photos and uploaded documents (max 10 MB)
    },
  },
  cacheComponents: true,
  partialPrefetching: true,
  serverExternalPackages: ["@react-pdf/renderer"],
  async redirects() {
    return [{ source: "/guide", destination: "/admin/guide", permanent: false }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
