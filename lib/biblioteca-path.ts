/** Rotas da área autenticada «Biblioteca». */
export function isBibliotecaPath(pathname: string): boolean {
  return pathname === "/biblioteca" || pathname.startsWith("/biblioteca/");
}
