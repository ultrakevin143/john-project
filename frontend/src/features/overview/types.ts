import type { Dma } from "../water-balance/types.js";
import type { Period,Row } from "../../shared/types.js";
export type Overview = {
  synthetic: boolean;
  observedAt: string;
  period: Period;
  nrw: {
    inputM3: number;
    billedM3: number;
    nrwPct: number | null;
    formula: string;
  } | null;
  quality: {
    total: number;
    breached: number;
    invalid: number;
    compliancePct: number | null;
    period: Period;
    limitsNotice: string;
  } | null;
  activeLeaks: number | null;
  openComplaints: number | null;
  dmas: (Pick<
    Dma,
    "id" | "name" | "code" | "diagramX" | "diagramY" | "connections"
  > &
    Partial<Dma>)[];
  sources: {
    id: string;
    code: string;
    name: string;
    domain: string;
    method: string;
    lastSuccessAt: string | null;
    freshnessHours: number;
    entity: string;
  }[];
  dq: {
    id: string;
    score: number;
    checked: number;
    failed: number;
    startedAt: string;
  } | null;
  attention: {
    id: string;
    kind: string;
    title: string;
    detail: string;
    dmaId: string;
    date: string;
    status: string;
    href: string;
    severity: string;
  }[];
  workOrders: Row[];
};
