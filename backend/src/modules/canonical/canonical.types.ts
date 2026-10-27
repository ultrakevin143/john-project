import type { Prisma, PrismaClient } from "@prisma/client";

export type DB = PrismaClient | Prisma.TransactionClient;
export type Canonical = {
  id: string;
  organizationId: string;
  sourceSystemId: string;
  sourceRecordId: string;
  sourceVersion: string;
  sourceUpdatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
} & Record<string, unknown>;
// One bounded delegate adapter serves the validated entity registry. Canonical fields
// remain typed in Prisma; arbitrary provider JSON is retained only in raw records.
export type Repository = {
  findMany(args: object): Promise<Canonical[]>;
  findFirst(args: object): Promise<Canonical | null>;
  count(args: object): Promise<number>;
  upsert(args: object): Promise<Canonical>;
  updateMany(args: object): Promise<{
    count: number;
  }>;
};
