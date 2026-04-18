import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/biblioteca/explorar", destination: "/explorar", permanent: true },
      { source: "/biblioteca/resultados", destination: "/biblioteca", permanent: true },
      {
        source: "/biblioteca/cifra/edit",
        destination: "/cifra/edit",
        permanent: true,
      },
      { source: "/biblioteca/cifra/a", destination: "/cifra/a", permanent: true },
      { source: "/biblioteca/cifra/m", destination: "/cifra/m", permanent: true },
      { source: "/biblioteca/cifra", destination: "/cifra", permanent: true },
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
    ],
  },
};

export default nextConfig;
