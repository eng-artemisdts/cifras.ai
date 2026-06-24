"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  fetchImportQuota,
  type ImportQuotaStatus,
} from "@/lib/import-quota-client";

type ImportQuotaContextValue = {
  quota: ImportQuotaStatus | null;
  loading: boolean;
  canImport: boolean;
  refreshQuota: () => Promise<void>;
};

const ImportQuotaContext = createContext<ImportQuotaContextValue | null>(null);

export function useImportQuota(): ImportQuotaContextValue {
  const ctx = useContext(ImportQuotaContext);
  if (!ctx) {
    throw new Error("useImportQuota deve ser usado dentro de ImportQuotaProvider.");
  }
  return ctx;
}

/** Opcional — páginas fora do provider não rebentam. */
export function useImportQuotaOptional(): ImportQuotaContextValue | null {
  return useContext(ImportQuotaContext);
}

export function ImportQuotaProvider({ children }: { children: ReactNode }) {
  const [quota, setQuota] = useState<ImportQuotaStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshQuota = useCallback(async () => {
    try {
      const next = await fetchImportQuota();
      setQuota(next);
    } catch {
      setQuota(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshQuota();
  }, [refreshQuota]);

  const canImport = quota ? quota.remaining > 0 : true;

  const value = useMemo(
    () => ({ quota, loading, canImport, refreshQuota }),
    [quota, loading, canImport, refreshQuota],
  );

  return (
    <ImportQuotaContext.Provider value={value}>{children}</ImportQuotaContext.Provider>
  );
}
