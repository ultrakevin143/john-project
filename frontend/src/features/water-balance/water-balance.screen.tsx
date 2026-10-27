"use client";

import { type Dma,type Nrw } from "@/features/water-balance/types";
import { type Envelope } from "@/shared/api/contracts";
import { PeriodLabel,Refresh,State } from "@/shared/data-display/index";
import { RecordDetails } from "@/shared/data-display/record-details";
import { number } from "@/shared/lib/utils";
import { type Row } from "@/shared/types";
import {
Badge,
Button,
Card,
CardHeader,
Input,
Label,
Table,
} from "@/shared/ui/index";
import { ArrowUpRight,Download } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import useSWR from "swr";

export function NetworkDiagram({
  dmas,
  active,
  onSelect,
  interactive = true,
}: {
  dmas: (Pick<Dma, "id" | "name" | "diagramX" | "diagramY"> & Partial<Dma>)[];
  active?: string;
  onSelect?: (id: string) => void;
  interactive?: boolean;
}) {
  return (
    <div
      className="network-diagram"
      aria-label="District metered area network; schematic, not geographic"
    >
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <path
          d={`M ${dmas[0]?.diagramX ?? 20} ${dmas[0]?.diagramY ?? 25} L ${dmas[1]?.diagramX ?? 75} ${dmas[1]?.diagramY ?? 22} L ${dmas[2]?.diagramX ?? 44} ${dmas[2]?.diagramY ?? 65} L ${dmas[3]?.diagramX ?? 85} ${dmas[3]?.diagramY ?? 80}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="0.7"
        />
        <path
          d="M 20 25 L 44 65"
          fill="none"
          stroke="currentColor"
          strokeWidth="0.7"
        />
      </svg>
      {dmas.map((d) => {
        const contents = (
          <>
            <span
              className={`node-dot${d.breaches ? " node-alert" : d.leaks ? " node-warning" : ""}`}
            />
            <strong>{d.name}</strong>
            <span>
              {d.breaches
                ? `${d.breaches} breach${d.breaches === 1 ? "" : "es"}`
                : d.leaks
                  ? `${d.leaks} active leak${d.leaks === 1 ? "" : "s"}`
                  : typeof d.nrwPct === "number"
                    ? `NRW ${number(d.nrwPct, 1)}%`
                    : "District area"}
            </span>
          </>
        );
        return onSelect ? (
          <button
            key={d.id}
            className={`network-node${active === d.id ? " selected" : ""}`}
            style={{ left: `${d.diagramX}%`, top: `${d.diagramY}%` }}
            onClick={() => onSelect(d.id)}
            aria-pressed={active === d.id}
          >
            {contents}
          </button>
        ) : interactive ? (
          <Link
            key={d.id}
            className="network-node"
            style={{ left: `${d.diagramX}%`, top: `${d.diagramY}%` }}
            href={`/network?dmaId=${d.id}`}
          >
            {contents}
          </Link>
        ) : (
          <div
            key={d.id}
            className="network-node"
            style={{ left: `${d.diagramX}%`, top: `${d.diagramY}%` }}
          >
            {contents}
          </div>
        );
      })}
      <span className="diagram-caption">Schematic DMA connections</span>
    </div>
  );
}
export function NetworkView() {
  const [dmaId, setDmaId] = useState(() =>
      typeof window !== "undefined"
        ? (new URLSearchParams(window.location.search).get("dmaId") ?? "")
        : "",
    ),
    [period, setPeriod] = useState<{
      from: string;
      to: string;
    } | null>(null),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [record, setRecord] = useState<Row | null>(null);
  const query = new URLSearchParams({
      ...(dmaId ? { dmaId } : {}),
      ...(period ?? {}),
    }).toString(),
    { data, error, isLoading, mutate } = useSWR<Envelope<Nrw>>(
      `/reports/nrw${query ? `?${query}` : ""}`,
    ),
    d = data?.data;
  const allQuery = new URLSearchParams(period ?? {}).toString();
  const { data: network, mutate: mutateNetwork } = useSWR<Envelope<Nrw>>(
    `/reports/nrw${allQuery ? `?${allQuery}` : ""}`,
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>District water balance</h1>
          <p>
            Trace non-revenue water from boundary input to billed consumption.
          </p>
        </div>
        <Refresh
          refresh={() => {
            mutate();
            if (dmaId) mutateNetwork();
          }}
        />
      </div>
      <form
        className="period-filter"
        onSubmit={(e) => {
          e.preventDefault();
          setPeriod(from && to ? { from, to } : null);
        }}
      >
        <div className="field">
          <Label htmlFor="nrw-from">Period start</Label>
          <Input
            id="nrw-from"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <Label htmlFor="nrw-to">Period end (exclusive)</Label>
          <Input
            id="nrw-to"
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
          Last complete month
        </Button>
      </form>
      <State loading={isLoading} error={error} retry={() => mutate()}>
        {d && (
          <>
            <div className="network-layout">
              <section className="network-map">
                <div className="network-map-heading">
                  <h2>Choose a district area</h2>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDmaId("")}
                  >
                    All areas
                  </Button>
                </div>
                <NetworkDiagram
                  dmas={network?.data.dmas ?? d.dmas}
                  active={dmaId}
                  onSelect={setDmaId}
                />
                <div className="dma-buttons">
                  {(network?.data.dmas ?? d.dmas).map((dma) => (
                    <Button
                      key={dma.id}
                      variant="outline"
                      size="sm"
                      onClick={() => setDmaId(dma.id)}
                    >
                      {dma.name}
                    </Button>
                  ))}
                  {dmaId && (
                    <Button variant="outline" onClick={() => setDmaId("")}>
                      Return to all district areas
                    </Button>
                  )}
                </div>
              </section>
              <Card className="water-equation">
                <h2>{dmaId ? d.dmas[0]?.name : "Whole district"}</h2>
                <p>
                  <PeriodLabel {...d.period} />
                </p>
                <div>
                  <span>System input</span>
                  <strong>
                    {number(d.inputM3)} <small>m³</small>
                  </strong>
                </div>
                <div>
                  <span>Less billed volume</span>
                  <strong>
                    − {number(d.billedM3)} <small>m³</small>
                  </strong>
                </div>
                <div className="equation-total">
                  <span>Non-revenue water</span>
                  <strong>
                    {number(d.lossM3)} <small>m³</small>
                  </strong>
                </div>
                <Badge tone="info">
                  {number(d.nrwPct, 1)}% of system input
                </Badge>
              </Card>
            </div>
            <p className="formula">
              {d.formula}
              <br />
              {d.coverage}
            </p>
            <Card>
              <CardHeader>
                <h2>DMA breakdown</h2>
                <a
                  className="button button-outline"
                  href={`/api/reports/nrw?${query ? query + "&" : ""}format=csv`}
                >
                  <Download size={15} />
                  Export CSV
                </a>
              </CardHeader>
              <Table>
                <thead>
                  <tr>
                    <th>Area</th>
                    <th className="numeric">Input m³</th>
                    <th className="numeric">Billed m³</th>
                    <th className="numeric">NRW</th>
                    <th>Lineage</th>
                  </tr>
                </thead>
                <tbody>
                  {d.dmas.map((dma) => (
                    <tr key={dma.id}>
                      <td>
                        <button
                          className="table-link"
                          onClick={() => setDmaId(dma.id)}
                        >
                          {dma.name}
                          <ArrowUpRight size={14} />
                        </button>
                        {dma.warning && (
                          <small className="error-text">{dma.warning}</small>
                        )}
                      </td>
                      <td className="numeric">{number(dma.inputM3)}</td>
                      <td className="numeric">{number(dma.billedM3)}</td>
                      <td className="numeric">{number(dma.nrwPct, 1)}%</td>
                      <td>
                        {dma.inputRecords} input / {dma.billingRecords} billing
                        records
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card>
            {d.lineage && (
              <Card>
                <CardHeader>
                  <div>
                    <h2>Underlying records</h2>
                    <p>
                      Boundary inputs and billing rows included in this balance.
                    </p>
                  </div>
                </CardHeader>
                <Table>
                  <thead>
                    <tr>
                      <th>Record</th>
                      <th>Type</th>
                      <th className="numeric">Volume m³</th>
                      <th>Source record</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.lineage.production.map((r) => (
                      <tr key={r.id}>
                        <td>
                          <button
                            className="table-link"
                            onClick={() => setRecord(r)}
                          >
                            {String(r.sourceRecordId)}
                          </button>
                        </td>
                        <td>Boundary input</td>
                        <td className="numeric">
                          {number(Number(r.volumeM3), 3)}
                        </td>
                        <td>
                          <Link href={`/operations/production?record=${r.id}`}>
                            View canonical record
                          </Link>
                        </td>
                      </tr>
                    ))}
                    {d.lineage.billing.map((r) => (
                      <tr key={r.id}>
                        <td>
                          <button
                            className="table-link"
                            onClick={() => setRecord(r)}
                          >
                            {String(r.reference)}
                          </button>
                        </td>
                        <td>Billed consumption</td>
                        <td className="numeric">
                          {number(Number(r.billedM3), 3)}
                        </td>
                        <td>
                          <Link href={`/operations/billing?record=${r.id}`}>
                            View canonical record
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </Card>
            )}
          </>
        )}
      </State>
      <RecordDetails record={record} onClose={() => setRecord(null)} />
    </>
  );
}
