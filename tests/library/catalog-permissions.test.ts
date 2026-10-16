import { beforeEach, describe, expect, it, vi } from "vitest";

const serverFetch = vi.fn();
vi.mock("@/lib/beethoven-server-api", () => ({
  fetchBeethovenFromServer: (...args: unknown[]) => serverFetch(...args),
}));
vi.mock("@/lib/beethoven-browser-client", () => ({ fetchBeethovenFromBrowser: vi.fn() }));

import { canDeleteCatalogTrack, fetchLibraryCatalog } from "@/lib/library/beethoven-library-catalog";
import { LibraryActionError, libraryActionErrorMessage } from "@/lib/library/beethoven-library-variations";

const ME = "auth0|eu";

function respondWith(tracks: unknown[]) {
  serverFetch.mockResolvedValue({ ok: true, json: async () => ({ tracks, artists: [] }) });
}

describe("biblioteca: quem pode excluir", () => {
  beforeEach(() => serverFetch.mockReset());

  it("com a Beethoven antiga (sem canDelete), a cifra importada não mostra excluir", async () => {
    respondWith([
      { id: "b1", trackKey: "url_base", name: "THE LONELIEST", artistName: "Måneskin", userId: ME, isOwnerVersion: false },
    ]);
    const { tracks } = await fetchLibraryCatalog({ userId: ME, tab: "musicas" });
    expect(tracks).toHaveLength(1);
    expect(tracks[0]!.canDeleteVersion).toBe(false);
  });

  it("a variação do utilizador aparece em card próprio, ao lado da base, e pode ser excluída", async () => {
    respondWith([
      { id: "b1", trackKey: "url_base", name: "THE LONELIEST", artistName: "Måneskin", isOwnerVersion: false, canDelete: false },
      { id: "v1", trackKey: "v_url_base_1", name: "THE LONELIEST", artistName: "Måneskin", isOwnerVersion: true, canDelete: true },
      { id: "v2", trackKey: "v_url_base_2", name: "THE LONELIEST", artistName: "Måneskin", isOwnerVersion: true, canDelete: true },
    ]);
    const { tracks } = await fetchLibraryCatalog({ userId: ME, tab: "musicas" });
    expect(tracks.map((t) => [t.trackKey, t.canDeleteVersion])).toEqual([
      ["url_base", false],
      ["v_url_base_1", true],
      ["v_url_base_2", true],
    ]);
  });

  it("a cifra importada pode ser excluída quando a Beethoven permite", async () => {
    respondWith([
      { id: "b1", trackKey: "url_base", name: "THE LONELIEST", artistName: "Måneskin", isOwnerVersion: false, canDelete: true },
    ]);
    const { tracks } = await fetchLibraryCatalog({ userId: ME, tab: "musicas" });
    expect(tracks[0]).toMatchObject({ canDeleteVersion: true, isOwnerVersion: false });
  });

  it("segue o canDelete do servidor e, sem ele, o isOwnerVersion", () => {
    expect(canDeleteCatalogTrack({ canDelete: false, isOwnerVersion: true })).toBe(false);
    expect(canDeleteCatalogTrack({ isOwnerVersion: true })).toBe(true);
    expect(canDeleteCatalogTrack({})).toBe(false);
  });
});

describe("biblioteca: mensagens de erro", () => {
  it("explica por que não excluiu, conforme o status", () => {
    expect(libraryActionErrorMessage(new LibraryActionError("x", 400), "delete-version")).toMatch(/Atualize a página/);
    expect(libraryActionErrorMessage(new LibraryActionError("x", 403), "delete-version")).toMatch(/Só quem criou/);
    expect(libraryActionErrorMessage(new LibraryActionError("x", 409), "delete-version")).toMatch(/Outras pessoas/);
    expect(libraryActionErrorMessage(new LibraryActionError("x", 401), "remove-library")).toMatch(/sessão expirou/);
    expect(libraryActionErrorMessage(new Error("rede"), "delete-version")).toMatch(/Tente novamente/);
  });
});
