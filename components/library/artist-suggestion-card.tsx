import type { ArtistSuggestion as ArtistSuggestionModel } from "@/lib/library/types";
import { artistAvatarClass } from "@/lib/library/style-maps";
import { cn } from "@/lib/utils";

export type ArtistSuggestionCardProps = {
  item: ArtistSuggestionModel;
  className?: string;
};

/**
 * Linha de artista sugerido com CTA visual Seguir / Seguindo (sem ação).
 */
export function ArtistSuggestionCard({ item, className }: ArtistSuggestionCardProps) {
  const following = item.followState === "following";
  const avatarUrl = item.avatarImageUrl?.trim();

  return (
    <article
      className={cn(
        "flex items-center gap-3.5 rounded-xl border border-white/[0.07] bg-cifra-surface p-4 md:gap-4",
        className
      )}
    >
      <div
        className={cn(
          "size-[52px] shrink-0 rounded-full",
          artistAvatarClass[item.avatarTone]
        )}
        aria-hidden
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- origem externa dinâmica
          <img src={avatarUrl} alt="" className="size-full rounded-full object-cover" />
        ) : null}
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <h3 className="text-[15px] font-semibold text-cifra-text">{item.name}</h3>
        <p className="text-xs text-cifra-muted">{item.description}</p>
      </div>
      <div
        className={cn(
          "pointer-events-none shrink-0 rounded-lg px-3.5 py-2 text-xs font-medium select-none",
          following
            ? "bg-cifra-teal font-semibold text-cifra-bg"
            : "border border-white/[0.07] text-cifra-text"
        )}
      >
        {following ? "Seguindo" : "Seguir"}
      </div>
    </article>
  );
}
