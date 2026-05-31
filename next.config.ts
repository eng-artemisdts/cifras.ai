import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withSentryConfig } from "@sentry/nextjs";

/** Caminho absoluto — `import.meta.dirname` sozinho falha quando o workspace é o monorepo pai. */
const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  turbopack: {
    root: projectRoot,
    resolveAlias: {
      tailwindcss: path.join(projectRoot, "node_modules/tailwindcss"),
      "@tailwindcss/postcss": path.join(projectRoot, "node_modules/@tailwindcss/postcss"),
    },
  },
  allowedDevOrigins: ["127.0.0.1"],
  async redirects() {
    return [
      { source: "/biblioteca/explorar", destination: "/explorar", permanent: true },
      { source: "/biblioteca/resultados", destination: "/biblioteca", permanent: true },
      {
        source: "/biblioteca/cifra/edit",
        destination: "/cifras/edit",
        permanent: true,
      },
      { source: "/biblioteca/cifra/a", destination: "/cifras", permanent: true },
      { source: "/biblioteca/cifra/m", destination: "/cifras", permanent: true },
      { source: "/cifra/a", destination: "/cifras", permanent: true },
      { source: "/cifra/m", destination: "/cifras", permanent: true },
      { source: "/cifra/edit", destination: "/cifras/edit", permanent: true },
      { source: "/cifra", destination: "/cifras", permanent: true },
      { source: "/biblioteca/cifra", destination: "/cifras", permanent: true },
    ];
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com", pathname: "/**" },
      { protocol: "https", hostname: "lh4.googleusercontent.com", pathname: "/**" },
      { protocol: "https", hostname: "lh5.googleusercontent.com", pathname: "/**" },
      { protocol: "https", hostname: "lh6.googleusercontent.com", pathname: "/**" },
      { protocol: "https", hostname: "s.gravatar.com", pathname: "/**" },
      { protocol: "https", hostname: "cdn.auth0.com", pathname: "/**" },
      { protocol: "https", hostname: "avatars.githubusercontent.com", pathname: "/**" },
      { protocol: "https", hostname: "i.scdn.co", pathname: "/**" },
      { protocol: "https", hostname: "mosaic.scdn.co", pathname: "/**" },
      { protocol: "https", hostname: "image-cdn-ak.spotifycdn.com", pathname: "/**" },
      { protocol: "https", hostname: "image-cdn-fa.spotifycdn.com", pathname: "/**" },
    ],
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  widenClientFileUpload: true,
  tunnelRoute: "/monitoring",
  silent: !process.env.CI,
  disableLogger: true,
});
