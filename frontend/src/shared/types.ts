export type Row = Record<string, unknown> & {
  id: string;
};
export type Period = {
  from: string;
  to: string;
  endExclusive?: boolean;
};
