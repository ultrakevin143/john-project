"use client";

import { type Envelope,type User } from "@/shared/api/contracts";
import { Refresh,State,display } from "@/shared/data-display/index";
import { dateTime,number } from "@/shared/lib/utils";
import { type Row } from "@/shared/types";
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
import { ArrowUpRight,Download } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import useSWR from "swr";

export function ReportsView({ user }: { user: User }) {
  const [report, setReport] = useState("operations"),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [period, setPeriod] = useState<{
      from: string;
      to: string;
    } | null>(null),
    q = new URLSearchParams(period ?? {}),
    key = `/reports/${report}${q.size ? `?${q}` : ""}`,
    { data, error, isLoading, mutate } =
      useSWR<Envelope<Record<string, unknown>>>(key),
    d = data?.data,
    rows = (
      report === "water-quality" ? d?.rows : report === "nrw" ? d?.dmas : []
    ) as Row[] | undefined;
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Operational reports</h1>
          <p>
            Defined periods, transparent calculations and audited CSV exports.
          </p>
        </div>
        <div className="heading-actions">
          <Refresh refresh={() => mutate()} />
          <a
            className="button button-primary"
            href={`/api/reports/${report}?${q.size ? q + "&" : ""}format=csv`}
          >
            <Download size={16} />
            Export CSV
          </a>
        </div>
      </div>
      <form
        className="period-filter"
        onSubmit={(e) => {
          e.preventDefault();
          setPeriod(from && to ? { from, to } : null);
        }}
      >
        <div className="field">
          <Label>Report</Label>
          <Select
            label="Report"
            value={report}
            onValueChange={setReport}
            options={[
              { value: "operations", label: "Service & leak response" },
              ...(user.permissions.includes("reports:nrw")
                ? [{ value: "nrw", label: "Non-revenue water" }]
                : []),
              ...(user.permissions.includes("domain:quality")
                ? [{ value: "water-quality", label: "Water-quality results" }]
                : []),
            ]}
          />
        </div>
        <div className="field">
          <Label htmlFor="report-from">Period start (Manila)</Label>
          <Input
            id="report-from"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <Label htmlFor="report-to">Period end (Manila, exclusive)</Label>
          <Input
            id="report-to"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            required
          />
        </div>
        <Button type="submit" variant="outline">
          Apply period
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setFrom("");
            setTo("");
            setPeriod(null);
          }}
        >
          Default period
        </Button>
      </form>
      <State loading={isLoading} error={error} retry={() => mutate()}>
        {d && (
          <Card>
            <CardHeader>
              <div>
                <h2>
                  {report === "operations"
                    ? "Service and field response"
                    : report === "nrw"
                      ? "DMA water balance"
                      : "Water-quality measurements"}
                </h2>
                <p>
                  {d.period
                    ? `${dateTime(String((d.period as Record<string, unknown>).from))} to ${dateTime(String((d.period as Record<string, unknown>).to))} (exclusive)`
                    : ""}
                </p>
              </div>
              <Badge tone="info">Synthetic data</Badge>
            </CardHeader>
            {report === "operations" ? (
              <>
                <div className="report-metrics">
                  {[
                    ["Work orders", d.workOrders],
                    ["Open work orders", d.openWorkOrders],
                    ["Active leaks", d.activeLeaks],
                    ["Complaints", d.complaints],
                    ["Mean dispatch (hours)", d.meanDispatchHours],
                    ["Mean repair (hours)", d.meanRepairHours],
                    [
                      "Mean case resolution (hours)",
                      d.meanComplaintResolutionHours,
                    ],
                  ].map(([name, value]) => (
                    <div key={String(name)}>
                      <span>{String(name)}</span>
                      <strong>
                        {value === null
                          ? "No completed observations"
                          : number(
                              Number(value),
                              String(name).startsWith("Mean") ? 2 : 0,
                            )}
                      </strong>
                    </div>
                  ))}
                </div>
                <p className="formula">{String(d.timingNotice)}</p>
                <Table>
                  <thead>
                    <tr>
                      <th>Complaint category</th>
                      <th className="numeric">Cases</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(
                      d.complaintsByCategory as {
                        category: string;
                        total: number;
                      }[]
                    ).map((r) => (
                      <tr key={r.category}>
                        <td>{r.category.toLowerCase().replaceAll("_", " ")}</td>
                        <td className="numeric">{r.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </>
            ) : rows?.length ? (
              <Table>
                <thead>
                  <tr>
                    {(report === "nrw"
                      ? ["DMA", "Input m³", "Billed m³", "NRW %", "Lineage"]
                      : [
                          "Sample",
                          "Point",
                          "Parameter",
                          "Result",
                          "Reference limits",
                          "State",
                          "Entered by",
                          "Correction version",
                        ]
                    ).map((h) => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      {report === "nrw" ? (
                        <>
                          <td>{String(r.name)}</td>
                          <td>{number(Number(r.inputM3))}</td>
                          <td>{number(Number(r.billedM3))}</td>
                          <td>
                            {r.nrwPct === null
                              ? "Unavailable"
                              : `${number(Number(r.nrwPct), 1)}%`}
                          </td>
                          <td>
                            <Link
                              className="table-link"
                              href={`/network?dmaId=${r.id}`}
                            >
                              Trace records
                              <ArrowUpRight size={14} />
                            </Link>
                          </td>
                        </>
                      ) : (
                        <>
                          <td>
                            <Link
                              href={`/operations/water-quality?record=${r.id}`}
                            >
                              {String(r.sampleReference)}
                            </Link>
                            <small>{dateTime(String(r.sampledAt))}</small>
                          </td>
                          <td>{String(r.point)}</td>
                          <td>{String(r.parameter)}</td>
                          <td>
                            {display(r.value)} {String(r.unit)}
                          </td>
                          <td>
                            {display(r.limitMin)}–{display(r.limitMax)}{" "}
                            {String(r.unit)}
                          </td>
                          <td>
                            <Badge
                              tone={
                                r.valid === false
                                  ? "warning"
                                  : r.breach
                                    ? "error"
                                    : "success"
                              }
                            >
                              {r.valid === false
                                ? "Invalid measurement"
                                : r.breach
                                  ? "Breach"
                                  : "Within limits"}
                            </Badge>
                          </td>
                          <td>{String(r.enteredBy)}</td>
                          <td>{String(r.correctionVersion)}</td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </Table>
            ) : (
              <Empty title="No observations in this period">
                Choose a period that contains the source records you want to
                report.
              </Empty>
            )}
            {!!d.formula && (
              <p className="formula">
                {String(d.formula)}
                <br />
                {String(d.coverage)}
              </p>
            )}
            {!!d.limitsNotice && (
              <p className="formula">{String(d.limitsNotice)}</p>
            )}
          </Card>
        )}
      </State>
    </>
  );
}
