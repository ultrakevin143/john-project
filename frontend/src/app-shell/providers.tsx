"use client";
import { fetcher } from "@/shared/api/client";
import type { ReactNode } from "react";
import { SWRConfig } from "swr";
const settings = {
  fetcher,
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
  refreshInterval: 0,
  shouldRetryOnError: false,
  dedupingInterval: 10000,
};
export function WorkspaceProviders({ children }: { children: ReactNode }) {
  return <SWRConfig value={settings}>{children}</SWRConfig>;
}
