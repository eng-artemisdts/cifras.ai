import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
    ],
  },
};

export default nextConfig;
