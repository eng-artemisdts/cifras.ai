import { Play } from "lucide-react";

import { parseLandingDemoVideoUrl } from "@/lib/landing/parse-demo-video-url";
import { cn } from "@/lib/utils";

type LandingHeroDemoProps = {
  className?: string;
};

/**
 * Área do hero para vídeo de demonstração do app.
 * Configure `NEXT_PUBLIC_LANDING_DEMO_VIDEO_URL` (YouTube ou .mp4/.webm).
 */
export function LandingHeroDemo({ className }: LandingHeroDemoProps) {
  const video = parseLandingDemoVideoUrl(
    process.env.NEXT_PUBLIC_LANDING_DEMO_VIDEO_URL,
  );

  return (
    <div
      className={cn(
        "relative mx-auto w-full motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-5 motion-safe:delay-300 motion-safe:duration-700 motion-safe:fill-mode-both motion-safe:ease-out",
        className,
      )}
    >
      <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-cifra-border bg-cifra-surface shadow-[0_24px_80px_-28px_rgba(15,210,193,0.35)] ring-1 ring-cifra-teal/10">
        {video?.kind === "youtube" ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(video.videoId)}?rel=0`}
            title="Demonstração do cifra.ai"
            className="absolute inset-0 h-full w-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        ) : video?.kind === "file" ? (
          <video
            src={video.src}
            controls
            playsInline
            preload="metadata"
            className="absolute inset-0 h-full w-full object-cover"
          >
            <track kind="captions" />
          </video>
        ) : (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-gradient-to-b from-cifra-surface to-cifra-surface-2 px-6"
            aria-hidden
          >
            <div className="flex size-16 items-center justify-center rounded-full border border-cifra-teal/30 bg-cifra-teal/10 text-cifra-teal shadow-[0_0_32px_-8px_rgba(15,210,193,0.45)]">
              <Play className="size-7 fill-current" strokeWidth={1.5} />
            </div>
            <p className="max-w-xs text-sm leading-relaxed text-cifra-muted">
              Espaço reservado para o vídeo de demonstração do app
            </p>
          </div>
        )}
      </div>
      {!video ? (
        <p className="sr-only">
          Vídeo de demonstração: configure NEXT_PUBLIC_LANDING_DEMO_VIDEO_URL com
          um link YouTube ou ficheiro de vídeo.
        </p>
      ) : null}
    </div>
  );
}
