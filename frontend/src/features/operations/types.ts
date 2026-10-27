export type Lookups = {
  tariffs: {
    id: string;
    name: string;
    code: string;
  }[];
  dmas: {
    id: string;
    name: string;
    code: string;
  }[];
  parameters: {
    id: string;
    name: string;
    unit: string;
    limitMin: number;
    limitMax: number;
  }[];
  sources: {
    id: string;
    name: string;
    code: string;
    entity: string;
  }[];
  facilities: {
    id: string;
    name: string;
    dmaId: string;
  }[];
  meters: {
    id: string;
    serialNumber: string;
    connectionId: string;
  }[];
  connections: {
    id: string;
    code: string;
    dmaId: string;
  }[];
  points: {
    id: string;
    name: string;
    dmaId: string;
  }[];
  workOrders: {
    id: string;
    reference: string;
    title: string;
  }[];
};
