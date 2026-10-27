"use client";

import { operationDefinitions } from "@/features/operations/definitions";
import { EditRecord } from "@/features/operations/edit-record";
import { type Lookups } from "@/features/operations/types";
import { type Envelope,type Page,type User } from "@/shared/api/contracts";
import {
Pager,
Refresh,
SearchBox,
State,
display,
} from "@/shared/data-display/index";
import { RecordDetails } from "@/shared/data-display/record-details";
import { number,pesos } from "@/shared/lib/utils";
import { type Row } from "@/shared/types";
import {
Alert,
Button,
Card,
CardHeader,
Dialog,
Empty,
Select,
Status,
Table,
} from "@/shared/ui/index";
import { ArrowUpRight,Pencil } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import useSWR from "swr";

export type Definition = {
  title: string;
  domain: string;
  columns: [string, string][];
  status?: string[];
};
export function OperationsView({
  user,
  entity: requested,
  initialRecordId = null,
}: {
  user: User;
  entity?: string;
  initialRecordId?: string | null;
}) {
  const available = Object.entries(operationDefinitions).filter(([, d]) =>
      user.permissions.includes(`domain:${d.domain}`),
    ),
    entity = requested ?? available[0]?.[0] ?? "meters",
    definition = operationDefinitions[entity],
    allowed =
      !!definition && user.permissions.includes(`domain:${definition.domain}`);
  const [page, setPage] = useState(1),
    [search, setSearch] = useState(""),
    [status, setStatus] = useState("all"),
    [sort, setSort] = useState("desc"),
    [dmaId, setDmaId] = useState("all"),
    [editing, setEditing] = useState<Row | null>(null),
    [detailId, setDetailId] = useState<string | null>(initialRecordId);
  const q = new URLSearchParams({
      page: String(page),
      pageSize: "10",
      search,
      sort,
      ...(status !== "all" ? { status } : {}),
      ...(dmaId !== "all" ? { dmaId } : {}),
    }),
    { data, error, isLoading, mutate } = useSWR<Page<Row>>(
      allowed ? `/operations/${entity}?${q}` : null,
    ),
    { data: lookups } = useSWR<Envelope<Lookups>>(
      allowed ? "/operations/lookups" : null,
    ),
    {
      data: detail,
      error: detailError,
      isLoading: detailLoading,
      mutate: mutateDetail,
    } = useSWR<Envelope<Row>>(
      allowed && detailId ? `/operations/${entity}/${detailId}` : null,
    );
  if (!allowed)
    return (
      <Alert title="Domain access required">
        Your role cannot open this operational domain.{" "}
        <Link href="/operations">Open your available operations</Link>.
      </Alert>
    );
  const l = lookups?.data,
    ref = (field: string, value: unknown) => {
      const list =
        field === "dmaId"
          ? l?.dmas
          : field === "meterId"
            ? l?.meters
            : field === "connectionId"
              ? l?.connections
              : field === "samplingPointId"
                ? l?.points
                : field === "parameterId"
                  ? l?.parameters
                  : field === "facilityId"
                    ? l?.facilities
                    : field === "tariffId"
                      ? l?.tariffs
                      : undefined;
      const match = list?.find((v) => v.id === value) as
        Record<string, unknown> | undefined;
      return match
        ? String(match.name ?? match.serialNumber ?? match.code)
        : display(value);
    };
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>{definition.title}</h1>
          <p>
            Canonical {definition.domain} records, with governed source lineage.
          </p>
          {user.permissions.includes("domain:metering") &&
            user.permissions.includes("reports:read") && (
              <Link className="text-link" href="/reliability">
                Open meter reliability
              </Link>
            )}
        </div>
        <Refresh refresh={() => mutate()} />
      </div>
      <nav className="operation-tabs" aria-label="Operational datasets">
        {available.map(([key, d]) => (
          <Link
            key={key}
            href={`/operations/${key}`}
            aria-current={entity === key ? "page" : undefined}
          >
            {d.title}
          </Link>
        ))}
      </nav>
      {["accounts", "billing", "complaints"].includes(entity) && (
        <div className="privacy-notice">
          Restricted domain · Customer identities are masked by default. Billing
          and laboratory records are retained with audited corrections.
        </div>
      )}
      {["billing", "water-quality"].includes(entity) && (
        <p className="privacy-notice">
          {entity === "billing"
            ? "PHP water charges use illustrative tariff versions; taxes and other fees are excluded."
            : "Four PNSDW reference parameters; laboratory comparisons do not certify potability."}{" "}
          <Link href="/reference">Review reference setup</Link>.
        </p>
      )}
      <Card>
        <CardHeader className="table-toolbar">
          <SearchBox
            onSearch={(v) => {
              setSearch(v);
              setPage(1);
            }}
            placeholder={
              entity === "accounts"
                ? "Search the visible 4-character suffix"
                : `Search ${definition.title.toLowerCase()}`
            }
          />
          <div className="toolbar-controls">
            <Select
              label="DMA filter"
              value={dmaId}
              onValueChange={(v) => {
                setDmaId(v);
                setPage(1);
              }}
              options={[
                { value: "all", label: "All DMAs" },
                ...(l?.dmas ?? []).map((d) => ({ value: d.id, label: d.name })),
              ]}
            />
            {definition.status && (
              <Select
                label="Status filter"
                value={status}
                onValueChange={(v) => {
                  setStatus(v);
                  setPage(1);
                }}
                options={[
                  { value: "all", label: "All statuses" },
                  ...definition.status.map((v) => ({
                    value: v,
                    label: v.toLowerCase().replaceAll("_", " "),
                  })),
                ]}
              />
            )}
            <Select
              label="Record order"
              value={sort}
              onValueChange={(v) => {
                setSort(v);
                setPage(1);
              }}
              options={[
                { value: "desc", label: "Newest loaded" },
                { value: "asc", label: "Oldest loaded" },
              ]}
            />
          </div>
        </CardHeader>
        <State loading={isLoading} error={error} retry={() => mutate()}>
          {data && (
            <>
              {data.data.length ? (
                <Table>
                  <thead>
                    <tr>
                      {definition.columns.map(([key, title]) => (
                        <th
                          key={key}
                          className={
                            /M3$|^value$|^amount$|Bar$|Ls$|Mm$|^lengthM$|M3Day$/.test(
                              key,
                            )
                              ? "numeric"
                              : undefined
                          }
                        >
                          {title}
                        </th>
                      ))}
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.data.map((row) => (
                      <tr key={row.id}>
                        {definition.columns.map(([key], i) => (
                          <td
                            key={key}
                            className={
                              /M3$|^value$|^amount$|Bar$|Ls$|Mm$|^lengthM$|M3Day$/.test(
                                key,
                              )
                                ? "numeric"
                                : undefined
                            }
                          >
                            {i === 0 ? (
                              <button
                                className="table-link"
                                onClick={() => setDetailId(row.id)}
                              >
                                {display(row[key])}
                                <ArrowUpRight size={13} />
                              </button>
                            ) : [
                                "status",
                                "priority",
                                "paymentStatus",
                                "readType",
                              ].includes(key) ? (
                              <Status value={String(row[key])} />
                            ) : key.endsWith("Id") ? (
                              ref(key, row[key])
                            ) : /M3$|^value$|^amount$|Bar$|Ls$|Mm$|^lengthM$|M3Day$/.test(
                                key,
                              ) ? (
                              key === "value" ? (
                                display(row[key])
                              ) : key === "amount" ? (
                                pesos(Number(row[key]))
                              ) : (
                                number(Number(row[key]), 1)
                              )
                            ) : (
                              display(row[key])
                            )}
                          </td>
                        ))}
                        <td>
                          {(entity === "water-quality" &&
                            user.permissions.includes("lab:correct")) ||
                          (["work-orders", "complaints"].includes(entity) &&
                            user.permissions.includes("field:write")) ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditing(row)}
                            >
                              <Pencil size={14} />
                              Update
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDetailId(row.id)}
                            >
                              Details
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              ) : (
                <Empty title="No matching records">
                  Change your filters or load this dataset through Integrations.
                </Empty>
              )}
              <Pager data={data} onPage={setPage} />
            </>
          )}
        </State>
      </Card>
      {detailId &&
        (detailLoading ? (
          <Dialog
            open
            title="Loading record"
            onOpenChange={(v) => {
              if (!v) setDetailId(null);
            }}
          >
            <p>Loading canonical values…</p>
          </Dialog>
        ) : detailError ? (
          <Dialog
            open
            title="Record unavailable"
            onOpenChange={(v) => {
              if (!v) setDetailId(null);
            }}
          >
            <Alert>{detailError.message}</Alert>
          </Dialog>
        ) : (
          <RecordDetails
            title={`${definition.title} · record`}
            record={detail?.data ?? null}
            onClose={() => setDetailId(null)}
          />
        ))}
      {editing && (
        <EditRecord
          key={editing.id}
          row={editing}
          entity={entity}
          lookups={l}
          onClose={() => setEditing(null)}
          onDone={() => {
            mutate();
            mutateDetail();
          }}
        />
      )}
    </>
  );
}
