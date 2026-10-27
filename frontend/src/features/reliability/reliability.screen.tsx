"use client";

import { type Page } from "@/shared/api/contracts";
import { Pager,Refresh,SearchBox,State } from "@/shared/data-display/index";
import { dateTime,number } from "@/shared/lib/utils";
import {
Badge,
Button,
Card,
CardHeader,
Empty,
Input,
Label,
Select,
Table,
} from "@/shared/ui/index";
import Link from "next/link";
import { useState } from "react";
import useSWR from "swr";

export type Meter = {
  id: string;
  serialNumber: string;
  dma?: {
    id: string;
    name: string;
  };
  readings: number;
  actual: number;
  estimated: number;
  missing: boolean;
  anomalies: {
    id: string;
    reasons: string[];
  }[];
};
export type Reliability = Page<Meter> & {
  summary: {
    expectedMeters: number;
    metersRead: number;
    missingMeters: number;
    actualReadings: number;
    estimatedReadings: number;
    estimatedPct: number | null;
    anomalousReadings: number;
  };
  dmas: {
    id: string;
    name: string;
  }[];
  period: {
    from: string;
    to: string;
  };
  threshold: number;
  coverage: string;
};
export function ReliabilityView() {
  const [period, setPeriod] = useState<{
      from: string;
      to: string;
    } | null>(null),
    [dma, setDma] = useState("all"),
    [page, setPage] = useState(1),
    [search, setSearch] = useState("");
  const q = new URLSearchParams({
      ...period,
      page: String(page),
      search,
      ...(dma !== "all" ? { dmaId: dma } : {}),
    }),
    { data, error, isLoading, mutate } = useSWR<Reliability>(
      `/insights/meter-reliability?${q}`,
    ),
    s = data?.summary;
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Meter reliability</h1>
          <p>
            Find missing readings, estimated consumption and register anomalies
            before billing.
          </p>
        </div>
        <Refresh refresh={() => mutate()} />
      </div>
      <form
        className="period-filter"
        onSubmit={(e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          setPeriod({
            from: String(form.get("from")),
            to: String(form.get("to")),
          });
          setPage(1);
        }}
      >
        <div className="field">
          <Label htmlFor="reliability-from">Period start (Manila)</Label>
          <Input id="reliability-from" name="from" type="date" required />
        </div>
        <div className="field">
          <Label htmlFor="reliability-to">Period end (exclusive)</Label>
          <Input id="reliability-to" name="to" type="date" required />
        </div>
        <Button variant="outline" type="submit">
          Apply period
        </Button>
        <Button
          variant="ghost"
          type="reset"
          onClick={() => {
            setPeriod(null);
            setPage(1);
          }}
        >
          Default period
        </Button>
        <Select
          label="Reliability DMA"
          value={dma}
          onValueChange={(v) => {
            setDma(v);
            setPage(1);
          }}
          options={[
            { value: "all", label: "All DMAs" },
            ...(data?.dmas ?? []).map((d) => ({ value: d.id, label: d.name })),
          ]}
        />
      </form>
      <State loading={isLoading} error={error} retry={() => mutate()}>
        {data && s && (
          <>
            <p className="small">
              {dateTime(data.period.from)} to {dateTime(data.period.to)}{" "}
              (exclusive). Synthetic data.
            </p>
            <div className="report-metrics">
              {[
                ["Eligible meters", s.expectedMeters],
                ["Meters with readings", s.metersRead],
                ["Missing meters", s.missingMeters],
                ["Actual readings", s.actualReadings],
                ["Estimated readings", s.estimatedReadings],
                [
                  "Estimated share",
                  s.estimatedPct === null
                    ? "No readings"
                    : `${s.estimatedPct}%`,
                ],
                ["Anomalous readings", s.anomalousReadings],
              ].map(([label, value]) => (
                <div key={String(label)}>
                  <span>{label}</span>
                  <strong>
                    {typeof value === "number" ? number(value) : value}
                  </strong>
                </div>
              ))}
            </div>
            <p className="formula">
              {data.coverage} Consumption threshold: {data.threshold} m³ per
              reading.
            </p>
            <Card>
              <CardHeader>
                <div>
                  <h2>Reading coverage by meter</h2>
                  <p>
                    One row per eligible meter. Open a meter or flagged reading
                    to investigate.
                  </p>
                </div>
                <SearchBox
                  placeholder="Search meter serials"
                  onSearch={(v) => {
                    setSearch(v);
                    setPage(1);
                  }}
                />
              </CardHeader>
              <Table>
                <thead>
                  <tr>
                    <th>Meter / DMA</th>
                    <th>Coverage</th>
                    <th>Actual / estimated</th>
                    <th>Findings</th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <Link
                          className="table-link"
                          href={`/operations/meters?record=${row.id}`}
                        >
                          {row.serialNumber}
                        </Link>
                        <div className="small">{row.dma?.name}</div>
                      </td>
                      <td>
                        <Badge tone={row.missing ? "warning" : "success"}>
                          {row.missing
                            ? "Missing reading"
                            : `${row.readings} readings`}
                        </Badge>
                      </td>
                      <td>
                        {row.actual} / {row.estimated}
                      </td>
                      <td>
                        {row.anomalies.length ? (
                          <ul className="finding-links">
                            {row.anomalies.map((a) => (
                              <li key={a.id}>
                                <Link
                                  className="table-link"
                                  href={`/operations/meter-readings?record=${a.id}`}
                                >
                                  {a.reasons.join("; ")}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          "No anomalies detected"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              {!data.data.length && (
                <Empty title="No eligible meters">
                  Change the period, DMA or search. No sample metrics are
                  substituted.
                </Empty>
              )}
              <Pager data={data} onPage={setPage} />
            </Card>
          </>
        )}
      </State>
    </>
  );
}
