"use client";

import { type Overview } from "@/features/overview/types";
import { NetworkDiagram } from "@/features/water-balance/water-balance.screen";
import { type Envelope,type User } from "@/shared/api/contracts";
import { PeriodLabel,Refresh,State } from "@/shared/data-display/index";
import { dateTime,number } from "@/shared/lib/utils";
import { Badge,Card,CardHeader,Empty,Table } from "@/shared/ui/index";
import { ArrowRight,ArrowUpRight,FlaskConical,Wrench } from "lucide-react";
import Link from "next/link";
import useSWR from "swr";

export function OverviewView({ user }: { user: User }) {
  const { data, error, isLoading, mutate } =
      useSWR<Envelope<Overview>>("/overview"),
    d = data?.data;
  return (
    <State loading={isLoading} error={error} retry={() => mutate()}>
      <div className="page-heading">
        <div>
          <h1>District overview</h1>
          <p>
            Cebu demo areas · Water quality and the work that needs attention.
          </p>
        </div>
        <Refresh refresh={() => mutate()} busy={isLoading} />
      </div>
      {d && (
        <>
          <section className="overview-band">
            <div className="overview-readings">
              <div className="band-context">
                <Badge tone="info">Synthetic district</Badge>
                <span>
                  {d.quality
                    ? "Lab results · Last 7 days"
                    : "Your authorized operations"}
                </span>
              </div>
              <div className="urgent-readings">
                {d.quality && (
                  <Link href="/operations/water-quality">
                    <strong>{d.quality.breached}</strong>
                    <div>
                      <FlaskConical size={19} />
                      <span>Water-quality breaches</span>
                      <ArrowUpRight size={16} />
                    </div>
                  </Link>
                )}
                {d.activeLeaks !== null && (
                  <Link href="/operations/leaks">
                    <strong>{d.activeLeaks}</strong>
                    <div>
                      <Wrench size={19} />
                      <span>Active leaks</span>
                      <ArrowUpRight size={16} />
                    </div>
                  </Link>
                )}
                {!d.quality && d.activeLeaks === null && (
                  <div>
                    <h2>Your operational datasets</h2>
                    <p className="band-notice">
                      Open the records available to your district role.
                    </p>
                    <Link className="button button-outline" href="/operations">
                      Open operations <ArrowUpRight size={16} />
                    </Link>
                  </div>
                )}
              </div>
              <div className="band-facts">
                {d.quality && (
                  <span>
                    <strong>
                      {d.quality.compliancePct === null
                        ? "No valid samples"
                        : `${number(d.quality.compliancePct, 1)}%`}
                    </strong>{" "}
                    {d.quality.compliancePct !== null &&
                      "within reference limits"}
                  </span>
                )}
                {d.openComplaints !== null && (
                  <span>
                    <strong>{d.openComplaints}</strong> open complaints
                  </span>
                )}
              </div>
              <p className="band-notice">
                {d.quality
                  ? "PNSDW reference comparison. Synthetic results do not certify water safety. Breaches still need review when an action is linked."
                  : "Only data within your assigned permissions is included."}
              </p>
            </div>
            <div className="overview-network">
              <h2>District network</h2>
              <NetworkDiagram dmas={d.dmas} interactive={!!d.nrw} />
            </div>
          </section>
          <div className="overview-meta">
            <span>Loaded {dateTime(d.observedAt)}</span>
            <span>
              {d.quality
                ? `${d.quality.total} lab observations`
                : `${d.dmas.length} district areas`}
              {d.sources.length
                ? ` · ${d.sources.length} governed source systems`
                : ""}
            </span>
          </div>
          <div className="overview-grid">
            <Card className="attention-panel">
              <CardHeader>
                <div>
                  <h2>Needs attention</h2>
                  <p>
                    Quality breaches and unresolved leaks, with source records.
                  </p>
                </div>
                <Badge tone="warning">{d.attention.length} items</Badge>
              </CardHeader>
              <div className="attention-list">
                {d.attention.length ? (
                  d.attention.map((item) => (
                    <Link
                      key={item.id}
                      href={item.href}
                      className="attention-row"
                    >
                      <span
                        className={`event-symbol ${item.severity === "ERROR" ? "event-error" : "event-warning"}`}
                      >
                        {item.kind === "Quality breach" ? (
                          <FlaskConical size={18} />
                        ) : (
                          <Wrench size={18} />
                        )}
                      </span>
                      <div>
                        <span className="event-type">
                          {item.kind} ·{" "}
                          {d.dmas.find((x) => x.id === item.dmaId)?.name ??
                            "District"}
                        </span>
                        <h3>{item.title}</h3>
                        <p>{item.detail}</p>
                        <span className="event-date">
                          {dateTime(item.date)}
                        </span>
                      </div>
                      <span className="attention-status">
                        <Badge
                          tone={item.severity === "ERROR" ? "error" : "warning"}
                        >
                          {item.status}
                        </Badge>
                        <ArrowUpRight size={17} />
                      </span>
                    </Link>
                  ))
                ) : (
                  <Empty
                    title={
                      d.quality || d.activeLeaks !== null
                        ? d.quality?.total === 0 && d.activeLeaks === 0
                          ? "Ready for source data"
                          : "No active exceptions"
                        : "Open your operational datasets"
                    }
                  >
                    {d.quality || d.activeLeaks !== null
                      ? d.quality?.total === 0 && d.activeLeaks === 0
                        ? "No lab observations or leak reports are loaded. Import source records to begin; an empty workspace does not indicate safe water."
                        : "No breaches or unresolved leaks in your available domains."
                      : "Use Operations to view the records included in your role."}
                  </Empty>
                )}
              </div>
            </Card>
            {(d.nrw || user.permissions.includes("dq:read")) && (
              <div className="overview-side">
                {d.nrw && (
                  <Card>
                    <CardHeader>
                      <h2>Water balance</h2>
                      {user.permissions.includes("reports:nrw") && (
                        <Link href="/network" aria-label="Open water balance">
                          <ArrowUpRight size={20} />
                        </Link>
                      )}
                    </CardHeader>
                    <div className="balance-summary">
                      <p>Last complete billing period</p>
                      <strong className="balance-number">
                        {number(d.nrw.nrwPct, 1)}
                        <span>% NRW</span>
                      </strong>
                      <PeriodLabel {...d.period} />
                      <div className="balance-values">
                        <span>
                          System input
                          <strong>{number(d.nrw.inputM3)} m³</strong>
                        </span>
                        <span>
                          Billed volume
                          <strong>{number(d.nrw.billedM3)} m³</strong>
                        </span>
                      </div>
                      <p className="small">
                        Simplified input-minus-billed balance. Internal
                        transfers are excluded.
                      </p>
                    </div>
                  </Card>
                )}
                {user.permissions.includes("dq:read") && (
                  <Card>
                    <CardHeader>
                      <h2>Data trust</h2>
                      {user.permissions.includes("dq:read") && (
                        <Link href="/quality" aria-label="Open data quality">
                          <ArrowUpRight size={20} />
                        </Link>
                      )}
                    </CardHeader>
                    <div className="trust-summary">
                      {d.dq ? (
                        <>
                          <strong>
                            {number(d.dq.score, 2)}
                            <span>%</span>
                          </strong>
                          <p>
                            {number(d.dq.failed)} failed checks across{" "}
                            {number(d.dq.checked)} record-rule observations.
                          </p>
                          <span className="small">
                            Run {dateTime(d.dq.startedAt)}
                          </span>
                        </>
                      ) : (
                        <p>No quality run yet.</p>
                      )}
                    </div>
                  </Card>
                )}
              </div>
            )}
          </div>
          {d.nrw && (
            <Card className="dma-summary">
              <CardHeader>
                <div>
                  <h2>District water balance</h2>
                  <p>
                    <PeriodLabel {...d.period} /> · m³
                  </p>
                </div>
                {user.permissions.includes("reports:nrw") && (
                  <Link href="/network" className="text-link">
                    Explore DMAs <ArrowRight size={16} />
                  </Link>
                )}
              </CardHeader>
              <Table>
                <thead>
                  <tr>
                    <th>District metered area</th>
                    <th className="numeric">System input</th>
                    <th className="numeric">Billed</th>
                    <th>Volume split</th>
                    <th className="numeric">NRW</th>
                  </tr>
                </thead>
                <tbody>
                  {d.dmas.map((dma) => (
                    <tr key={dma.id}>
                      <td>
                        {user.permissions.includes("reports:nrw") ? (
                          <Link
                            className="table-link"
                            href={`/network?dmaId=${dma.id}`}
                          >
                            {dma.name} <ArrowUpRight size={14} />
                          </Link>
                        ) : (
                          dma.name
                        )}
                        <small>{dma.code}</small>
                      </td>
                      <td className="numeric">{number(dma.inputM3)}</td>
                      <td className="numeric">{number(dma.billedM3)}</td>
                      <td>
                        <div
                          className="volume-bar"
                          aria-label={`Billed ${number(dma.billedM3)} of ${number(dma.inputM3)} cubic metres`}
                        >
                          <span
                            style={{
                              width: `${Math.min(100, dma.inputM3 ? (Number(dma.billedM3) / dma.inputM3) * 100 : 0)}%`,
                            }}
                          />
                        </div>
                      </td>
                      <td className="numeric">
                        <strong>{number(dma.nrwPct, 1)}%</strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              <div className="panel-footnote">
                <span className="legend-dot" />
                Billed volume <span className="legend-dot loss" />
                Non-revenue water
              </div>
            </Card>
          )}
          {d.sources.length > 0 && (
            <section className="source-status">
              <div>
                <h2>Source freshness</h2>
                <p>Last successful ingestion; refreshes only when requested.</p>
              </div>
              <div className="source-status-list">
                {d.sources.map((s) => {
                  const fresh =
                    !!s.lastSuccessAt &&
                    new Date(d.observedAt).getTime() -
                      new Date(s.lastSuccessAt).getTime() <=
                      s.freshnessHours * 3600000;
                  return (
                    <div key={s.id}>
                      <Badge tone={fresh ? "success" : "warning"}>
                        {fresh ? "Within interval" : "Stale"}
                      </Badge>
                      <strong>{s.name}</strong>
                      <span>{dateTime(s.lastSuccessAt)}</span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </>
      )}
    </State>
  );
}
