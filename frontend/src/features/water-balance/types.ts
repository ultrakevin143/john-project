import type { Period,Row } from "../../shared/types.js";
export type Dma = {
  id: string;
  code: string;
  name: string;
  diagramX: number;
  diagramY: number;
  connections: number;
  inputM3: number;
  billedM3: number;
  lossM3: number;
  nrwPct: number | null;
  inputRecords: number;
  billingRecords: number;
  warning: string | null;
  breaches?: number;
  leaks?: number;
};
export type Nrw = {
  period: Period;
  formula: string;
  coverage: string;
  inputM3: number;
  billedM3: number;
  lossM3: number;
  nrwPct: number | null;
  dmas: Dma[];
  lineage?: {
    production: Row[];
    billing: Row[];
  };
};
