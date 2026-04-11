import type { Metadata } from "next";

import { LandingPage } from "@/components/landing-page";
import { getSiteUrl } from "@/components/seo/google-site-seo";

export const metadata: Metadata = {
  alternates: { canonical: getSiteUrl() },
};

export default function Home() {
  return <LandingPage />;
}
