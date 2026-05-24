import { fetchBeethovenFromBrowser } from "@/lib/beethoven-browser-client";

export type LibrarySearchTrackRow = {
  id: string;
  trackKey: string | null;
  name: string;
  artistName: string;
  artistId: string;
  imageUrl: string | null;
};

export type LibrarySearchResponse = {
  items: LibrarySearchTrackRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

function parseSearchResponse(data: unknown): LibrarySearchResponse {
  if (!data || typeof data !== "object") {
    return { items: [], total: 0, page: 1, limit: 12, totalPages: 0 };
  }
  const o = data as Record<string, unknown>;
  const itemsRaw = o.items;
  const items: LibrarySearchTrackRow[] = Array.isArray(itemsRaw)
    ? itemsRaw.map((row, index) => {
        if (!row || typeof row !== "object") {
          return {
            id: `unknown-${index}`,
            trackKey: null,
            name: "Sem nome",
            artistName: "Artista desconhecido",
            artistId: "",
            imageUrl: null,
          };
        }
        const r = row as Record<string, unknown>;
        return {
          id: typeof r.id === "string" ? r.id : `unknown-${index}`,
          trackKey: typeof r.trackKey === "string" ? r.trackKey : null,
          name: typeof r.name === "string" ? r.name : "Sem nome",
          artistName: typeof r.artistName === "string" ? r.artistName : "Artista desconhecido",
          artistId: typeof r.artistId === "string" ? r.artistId : "",
          imageUrl: typeof r.imageUrl === "string" ? r.imageUrl : null,
        };
      })
    : [];

  const total = typeof o.total === "number" && Number.isFinite(o.total) ? o.total : 0;
  const page = typeof o.page === "number" && Number.isFinite(o.page) ? o.page : 1;
  const limit = typeof o.limit === "number" && Number.isFinite(o.limit) ? o.limit : 12;
  const totalPages =
    typeof o.totalPages === "number" && Number.isFinite(o.totalPages) ? o.totalPages : 0;

  return { items, total, page, limit, totalPages };
}

/** Chamadas a partir de componentes cliente (cookie de sessão → proxy Beethoven). */
export async function fetchLibrarySearch(params: {
  search: string;
  page?: number;
  limit?: number;
}): Promise<LibrarySearchResponse> {
  const q = params.search.trim();
  const query = new URLSearchParams();
  query.set("search", q);
  query.set("page", String(params.page ?? 1));
  query.set("limit", String(params.limit ?? 12));

  const res = await fetchBeethovenFromBrowser(`library-home/search?${query.toString()}`);
  if (!res.ok) {
    throw new Error(`library_search_failed:${res.status}`);
  }
  const data = (await res.json()) as unknown;
  return parseSearchResponse(data);
}
