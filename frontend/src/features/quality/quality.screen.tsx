"use client";

import { QualityTrends } from "@/features/quality/quality-trends";
import { type QualityResult,type QualityRun } from "@/features/quality/types";
import { api,post } from "@/shared/api/client";
import { type Envelope,type Page,type User } from "@/shared/api/contracts";
import { Refresh,State,display } from "@/shared/data-display/index";
import { dateTime,number } from "@/shared/lib/utils";
import {
Alert,
Badge,
Button,
Card,
CardHeader,
Dialog,
Empty,
Label,
Select,
Status,
Table,
Textarea,
} from "@/shared/ui/index";
import { ArrowUpRight,ClipboardCheck,Play } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import useSWR,{ useSWRConfig } from "swr";

export const thresholdNames: Record<string, string> = {
  tolerancePhp: "Water-charge tolerance (PHP)",
  futureMinutes: "Future timestamp tolerance (minutes)",
  toleranceM3: "Billing tolerance (m³)",
  maxRatio: "Maximum estimated-read ratio",
  maxConsumptionM3: "Maximum consumption (m³)",
  maxFlowLs: "Maximum flow (L/s)",
  maxPressureBar: "Maximum pressure (bar)",
  minPressureBar: "Minimum pressure (bar)",
};
export function QualityDetails({
  result,
  onClose,
}: {
  result: QualityResult;
  onClose: () => void;
}) {
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={`${result.rule.code} · ${result.rule.name}`}
      description={result.rule.description}
      wide
    >
      <div className="rule-summary">
        <Status value={result.severity} />
        <span>
          {result.rule.domain} / {result.rule.entity.replaceAll("-", " ")}
        </span>
        <Badge tone={result.passed ? "success" : "warning"}>
          {result.passed ? "Passed" : "Investigation needed"}
        </Badge>
      </div>
      <dl className="rule-facts">
        <div>
          <dt>Records checked</dt>
          <dd>{number(result.checked)}</dd>
        </div>
        <div>
          <dt>Failed observations</dt>
          <dd>{number(result.failed)}</dd>
        </div>
        <div>
          <dt>Remediation</dt>
          <dd>
            <Status value={result.remediation} />
          </dd>
        </div>
      </dl>
      {Object.keys(result.rule.config).length > 0 && (
        <section className="rule-section">
          <h3>Configured thresholds</h3>
          <dl className="threshold-list">
            {Object.entries(result.rule.config).map(([key, value]) => (
              <div key={key}>
                <dt>
                  {thresholdNames[key] ??
                    key.replace(/([a-z])([A-Z])/g, "$1 $2")}
                </dt>
                <dd>
                  {key === "maxRatio"
                    ? `${Number(value) * 100}%`
                    : typeof value === "object"
                      ? "Administrator-managed setting"
                      : String(value)}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}
      <section className="rule-section">
        <h3>Affected record samples</h3>
        <p>
          Up to five records from this quality snapshot. Correct the source data
          and run the checks again to verify improvement.
        </p>
        {result.samples.length ? (
          <Table>
            <thead>
              <tr>
                <th>Record</th>
                <th>Finding</th>
                <th>Observed values</th>
              </tr>
            </thead>
            <tbody>
              {result.samples.map((sample) => (
                <tr key={sample.id}>
                  <td>
                    {sample.entity ? (
                      <Link
                        className="table-link"
                        href={`/operations/${sample.entity}?record=${sample.id}`}
                      >
                        {sample.label ?? "View affected record"}
                        <ArrowUpRight size={14} />
                      </Link>
                    ) : (
                      <strong>
                        {sample.label ?? `Record ${sample.id.slice(0, 8)}`}
                      </strong>
                    )}
                  </td>
                  <td>{sample.reason}</td>
                  <td>
                    {sample.values?.length ? (
                      <dl className="sample-values">
                        {sample.values.map((v) => (
                          <div key={v.label}>
                            <dt>{v.label}</dt>
                            <dd>{display(v.value)}</dd>
                          </div>
                        ))}
                      </dl>
                    ) : (
                      <span className="small">
                        Open the canonical record for its current values.
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <Empty title="No failed samples">
            This rule found no failing records in this snapshot.
          </Empty>
        )}
      </section>
      {result.remediationNote && (
        <section className="rule-section">
          <h3>Investigation note</h3>
          <p>{result.remediationNote}</p>
        </section>
      )}
    </Dialog>
  );
}
export function Remediate({
  result,
  onClose,
  onDone,
}: {
  result: QualityResult;
  onClose: () => void;
  onDone: () => void;
}) {
  const [state, setState] = useState(result.remediation),
    [note, setNote] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <Dialog
      open
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
      title="Record remediation"
      description={`${result.rule.code} · ${result.rule.name}`}
    >
      <form
        className="edit-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await api(`/dq/results/${result.id}`, {
              method: "PATCH",
              body: JSON.stringify({ remediation: state, note }),
            });
            toast.success("Remediation note saved");
            onDone();
            onClose();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Unable to save.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="field">
          <Label>Remediation state</Label>
          <Select
            label="Remediation state"
            value={state}
            onValueChange={setState}
            options={["OPEN", "ACKNOWLEDGED", "RESOLVED"].map((v) => ({
              value: v,
              label: v.toLowerCase(),
            }))}
          />
        </div>
        <div className="field">
          <Label htmlFor="remediation-note">
            Investigation / resolution note
          </Label>
          <Textarea
            id="remediation-note"
            required
            minLength={8}
            maxLength={500}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        <p className="small">
          Acknowledgement and resolution notes do not change the score. Correct
          the data and run quality again to verify improvement.
        </p>
        {error && <Alert>{error}</Alert>}
        <div className="form-actions">
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            Save remediation
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
export function QualityView({ user }: { user: User }) {
  const { mutate: mutateCache } = useSWRConfig();
  const [showTrends, setShowTrends] = useState(false);
  const [runId, setRunId] = useState("latest"),
    [severity, setSeverity] = useState("all"),
    [outcome, setOutcome] = useState("all"),
    [busy, setBusy] = useState(false),
    [selected, setSelected] = useState<QualityResult | null>(null),
    [sample, setSample] = useState<QualityResult | null>(null),
    { data, error, isLoading, mutate } = useSWR<Envelope<QualityRun | null>>(
      `/dq/scorecards${runId !== "latest" ? `?runId=${runId}` : ""}`,
    ),
    { data: history, mutate: mutateHistory } = useSWR<Page<QualityRun>>(
      "/dq/runs?pageSize=20",
    ),
    d = data?.data,
    can = user.permissions.includes("dq:write");
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Data quality</h1>
          <p>
            Twenty-one governed checks across integration, Cebu reference data
            and water operations.
          </p>
        </div>
        <div className="heading-actions">
          <Button variant="outline" onClick={() => setShowTrends(!showTrends)}>
            {showTrends ? "Hide trends" : "View trends"}
          </Button>
          <Refresh
            refresh={() => {
              mutate();
              mutateHistory();
            }}
          />
          {can && (
            <Button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await post("/dq/runs", {});
                  await mutateCache(
                    "/dq/scorecards",
                    api<Envelope<QualityRun | null>>("/dq/scorecards"),
                    { revalidate: false },
                  );
                  await mutateCache("/insights/quality-trends", undefined, {
                    revalidate: true,
                  });
                  setRunId("latest");
                  mutateHistory();
                  toast.success("Quality snapshot completed");
                } catch (err) {
                  toast.error(
                    err instanceof Error ? err.message : "Quality run failed.",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Play size={15} />
              {busy ? "Checking records…" : "Run quality checks"}
            </Button>
          )}
        </div>
      </div>
      {showTrends && (
        <QualityTrends
          onSelect={(id) => {
            setRunId(id);
            setShowTrends(false);
          }}
        />
      )}
      <div className="quality-controls">
        <Select
          label="Quality run"
          value={runId}
          onValueChange={setRunId}
          options={[
            { value: "latest", label: "Latest successful snapshot" },
            ...(history?.data ?? []).map((r) => ({
              value: r.id,
              label: `${dateTime(r.startedAt)} · ${r.status.toLowerCase()}`,
            })),
          ]}
        />
        <Select
          label="Severity filter"
          value={severity}
          onValueChange={setSeverity}
          options={[
            { value: "all", label: "All severities" },
            ...(["ERROR", "WARNING", "INFO"] as const).map((v) => ({
              value: v,
              label: v.toLowerCase(),
            })),
          ]}
        />
        <Select
          label="Outcome filter"
          value={outcome}
          onValueChange={setOutcome}
          options={[
            { value: "all", label: "All outcomes" },
            { value: "failed", label: "Needs investigation" },
            { value: "passed", label: "Passed checks" },
          ]}
        />
      </div>
      <State loading={isLoading} error={error} retry={() => mutate()}>
        {d ? (
          <>
            <section className="quality-summary">
              <div>
                <strong>
                  {number(d.score, 2)}
                  <span>%</span>
                </strong>
                <span>Record-rule checks passed</span>
              </div>
              <div>
                <p>
                  <strong>{number(d.checked - d.failed)}</strong> passed /{" "}
                  {number(d.checked)} checked
                </p>
                <p>
                  <strong>{number(d.failed)}</strong> failed observations
                </p>
                <p>
                  {dateTime(d.startedAt)} · <Status value={d.status} />
                </p>
              </div>
              <div>
                <ClipboardCheck size={23} />
                <p>{d.formula}</p>
                <p className="small">
                  The score is not a regulatory compliance rating. Lab limit
                  breaches appear separately in Operations.
                </p>
              </div>
            </section>
            <Card>
              <CardHeader>
                <div>
                  <h2>Rule results</h2>
                  <p>
                    Each rule persists its checked count, failure samples and
                    investigation state.
                  </p>
                </div>
                <Badge>{d.results.length} active rules</Badge>
              </CardHeader>
              <Table>
                <thead>
                  <tr>
                    <th>Rule / domain</th>
                    <th>Severity</th>
                    <th className="numeric">Checked</th>
                    <th className="numeric">Failed</th>
                    <th>Outcome</th>
                    <th>Remediation</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {d.results
                    .filter(
                      (r) =>
                        (severity === "all" || r.severity === severity) &&
                        (outcome === "all" ||
                          (outcome === "failed" ? !r.passed : r.passed)),
                    )
                    .map((r) => (
                      <tr key={r.id}>
                        <td>
                          <strong>
                            {r.rule.code} · {r.rule.name}
                          </strong>
                          <small>
                            {r.rule.domain} · {r.rule.description}
                          </small>
                        </td>
                        <td>
                          <Status value={r.severity} />
                        </td>
                        <td className="numeric">{number(r.checked)}</td>
                        <td className="numeric">
                          {r.failed ? (
                            <Badge tone="error">{r.failed}</Badge>
                          ) : (
                            "0"
                          )}
                        </td>
                        <td>
                          <Badge tone={r.passed ? "success" : "warning"}>
                            {r.passed ? "Passed" : "Investigate"}
                          </Badge>
                        </td>
                        <td>
                          <Status value={r.remediation} />
                        </td>
                        <td>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSample({ ...r })}
                          >
                            Inspect
                            <ArrowUpRight size={14} />
                          </Button>
                          {can && !r.passed && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelected(r)}
                            >
                              Remediate
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </Table>
            </Card>
            <p className="formula">
              One record may be checked by several rules. Failure samples are
              limited to five records per rule. Quality runs use a consistent
              database snapshot.
            </p>
          </>
        ) : (
          <Empty title="No quality snapshot yet">
            An authorized steward can run the first set of quality checks.
          </Empty>
        )}
      </State>
      {sample && (
        <QualityDetails result={sample} onClose={() => setSample(null)} />
      )}
      {selected && (
        <Remediate
          key={selected.id}
          result={selected}
          onClose={() => setSelected(null)}
          onDone={() => mutate()}
        />
      )}
    </>
  );
}
