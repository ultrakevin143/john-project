"use client";

import { type Page } from "@/shared/api/contracts";
import { Pager,Refresh,SearchBox,State } from "@/shared/data-display/index";
import { RecordDetails } from "@/shared/data-display/record-details";
import { dateTime } from "@/shared/lib/utils";
import { type Row } from "@/shared/types";
import { Card,CardHeader,Empty,Select,Table } from "@/shared/ui/index";
import { useState } from "react";
import useSWR from "swr";

export function AuditView() {
  const [page, setPage] = useState(1),
    [search, setSearch] = useState(""),
    [entity, setEntity] = useState("all"),
    [sort, setSort] = useState("desc"),
    [selected, setSelected] = useState<Row | null>(null),
    q = new URLSearchParams({
      page: String(page),
      search,
      sort,
      ...(entity !== "all" ? { entity } : {}),
    }),
    { data, error, isLoading, mutate } = useSWR<Page<Row>>(
      `/audit-events?${q}`,
    );
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Audit trail</h1>
          <p>
            Immutable events for access, integration, quality and governed
            changes.
          </p>
        </div>
        <Refresh refresh={() => mutate()} />
      </div>
      <Card>
        <CardHeader className="table-toolbar">
          <SearchBox
            placeholder="Search actions or actors"
            onSearch={(v) => {
              setSearch(v);
              setPage(1);
            }}
          />
          <div className="toolbar-controls">
            <Select
              label="Audit entity"
              value={entity}
              onValueChange={(v) => {
                setEntity(v);
                setPage(1);
              }}
              options={[
                { value: "all", label: "All entities" },
                ...[
                  "session",
                  "integration-run",
                  "import-record",
                  "dq-run",
                  "dq-result",
                  "data-asset",
                  "water-quality",
                  "work-orders",
                  "complaints",
                  "report",
                ].map((v) => ({ value: v, label: v.replaceAll("-", " ") })),
              ]}
            />
            <Select
              label="Audit time order"
              value={sort}
              onValueChange={(v) => {
                setSort(v);
                setPage(1);
              }}
              options={[
                { value: "desc", label: "Newest first" },
                { value: "asc", label: "Oldest first" },
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
                      <th>When (PHT)</th>
                      <th>Action</th>
                      <th>Actor</th>
                      <th>Entity</th>
                      <th>Reason / detail</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.data.map((event) => (
                      <tr key={event.id}>
                        <td>{dateTime(String(event.createdAt))}</td>
                        <td>
                          <button
                            className="table-link"
                            onClick={() => setSelected(event)}
                          >
                            {String(event.action)
                              .toLowerCase()
                              .replaceAll("_", " ")}
                          </button>
                        </td>
                        <td>{String(event.actorName)}</td>
                        <td>{String(event.entity)}</td>
                        <td>
                          {event.reason
                            ? String(event.reason)
                            : "System-recorded event"}
                          <small>Request {String(event.requestId)}</small>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              ) : (
                <Empty title="No audit events match">
                  Change the filters to find a different action or actor.
                </Empty>
              )}
              <Pager data={data} onPage={setPage} />
            </>
          )}
        </State>
      </Card>
      <p className="formula">
        Database triggers reject changes and deletions to audit events.
        Administrative database access still requires separate production
        controls.
      </p>
      <RecordDetails
        title="Audit event details"
        record={selected}
        onClose={() => setSelected(null)}
      />
    </>
  );
}
