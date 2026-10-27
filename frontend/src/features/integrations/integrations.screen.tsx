"use client";

import {
type ImportError,
type Run,
type Source,
} from "@/features/integrations/types";
import { post } from "@/shared/api/client";
import { type Envelope,type Page,type User } from "@/shared/api/contracts";
import { Pager,Refresh,SearchBox,State } from "@/shared/data-display/index";
import { dateTime,label,number } from "@/shared/lib/utils";
import {
Alert,
Badge,
Button,
Card,
CardHeader,
Dialog,
Empty,
Input,
Label,
Select,
Status,
Table,
Textarea,
} from "@/shared/ui/index";
import { ArrowUpRight,FileText,Play,RotateCcw,Upload } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";

export const sourceEntities: Record<string, string[]> = {
  billing: ["billing", "accounts"],
  "meter-readings": ["meter-readings", "meters", "service-connections"],
  production: ["production", "facilities"],
  "water-quality": ["water-quality", "sampling-points"],
  "work-orders": ["work-orders", "leaks"],
  complaints: ["complaints"],
  pipelines: ["pipelines"],
};
export function ImportForm({
  sources,
  onClose,
  onDone,
}: {
  sources: Source[];
  onClose: () => void;
  onDone: (run: Run) => void;
}) {
  const [sourceId, setSourceId] = useState(sources[0]?.id ?? ""),
    [entity, setEntity] = useState(sources[0]?.entity ?? ""),
    [format, setFormat] = useState("mock"),
    [contents, setContents] = useState(""),
    [key, setKey] = useState(() => `ui-${crypto.randomUUID()}`),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const source = sources.find((s) => s.id === sourceId);
  return (
    <Dialog
      open
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
      title="Load a source snapshot"
      description="Validate, standardize and quarantine records before the canonical load."
      wide
    >
      <form
        className="edit-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            const body = {
              sourceSystemId: sourceId,
              entity,
              idempotencyKey: key,
              format,
              ...(format === "csv"
                ? { csv: contents }
                : format === "json"
                  ? { records: JSON.parse(contents) }
                  : {}),
            };
            const result = await post<Envelope<Run>>(
              "/integrations/imports",
              body,
            );
            toast.success(
              `Import finished: ${result.data.processed} loaded, ${result.data.failed} quarantined`,
            );
            onDone(result.data);
            onClose();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Import failed.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="form-grid">
          <div className="field">
            <Label>Source system</Label>
            <Select
              label="Source system"
              value={sourceId}
              onValueChange={(v) => {
                setSourceId(v);
                setEntity(sources.find((s) => s.id === v)?.entity ?? "");
              }}
              options={sources.map((s) => ({ value: s.id, label: s.name }))}
            />
          </div>
          <div className="field">
            <Label>Canonical dataset</Label>
            <Select
              label="Canonical dataset"
              value={entity}
              onValueChange={setEntity}
              options={(sourceEntities[source?.entity ?? ""] ?? []).map(
                (e) => ({ value: e, label: e.replaceAll("-", " ") }),
              )}
            />
          </div>
        </div>
        <div className="field">
          <Label>Ingestion method</Label>
          <Select
            label="Ingestion method"
            value={format}
            onValueChange={setFormat}
            options={[
              { value: "mock", label: "Synthetic provider snapshot" },
              { value: "csv", label: "CSV batch" },
              { value: "json", label: "Canonical JSON records" },
            ]}
          />
        </div>
        {format === "mock" ? (
          <div className="information-box">
            <Play size={19} />
            <p>
              Replays records already loaded in this dataset through the same
              validation pipeline. Load a CSV first when the dataset is empty.
              It makes no external provider request. Unchanged records are
              skipped.
            </p>
          </div>
        ) : (
          <>
            <div className="field">
              <Label htmlFor="import-file">
                Choose {format.toUpperCase()} file
              </Label>
              <Input
                id="import-file"
                type="file"
                accept={
                  format === "csv" ? ".csv,text/csv" : ".json,application/json"
                }
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > 1000000) {
                    setError("Choose a file under 1 MB.");
                    return;
                  }
                  setContents(await file.text());
                }}
              />
            </div>
            <div className="field">
              <Label htmlFor="import-contents">
                {format.toUpperCase()} contents
              </Label>
              <Textarea
                className="payload-editor"
                id="import-contents"
                rows={8}
                required
                value={contents}
                onChange={(e) => setContents(e.target.value)}
                placeholder={
                  format === "csv"
                    ? "Paste canonical CSV with a header row"
                    : "Paste an array of canonical records"
                }
              />
            </div>
            <p className="small">
              Up to 500 records. Source identifiers and timestamps with a UTC
              offset are required. Canonical field contracts are available in{" "}
              <a href="/api/docs" target="_blank" rel="noreferrer">
                API documentation
              </a>
              .
            </p>
          </>
        )}
        <div className="field">
          <Label htmlFor="import-key">Replay protection key</Label>
          <Input
            id="import-key"
            required
            minLength={8}
            maxLength={120}
            value={key}
            onChange={(e) => setKey(e.target.value)}
          />
          <p className="small">
            Reuse this key for the same snapshot. Changed content needs a new
            key.
          </p>
        </div>
        {error && <Alert title="Import did not start">{error}</Alert>}
        <div className="form-actions">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy || !sourceId}>
            <Upload size={15} />
            {busy ? "Processing…" : "Validate and import"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
export function CorrectError({
  error,
  onClose,
  onDone,
}: {
  error: ImportError;
  onClose: () => void;
  onDone: () => void;
}) {
  const [payload, setPayload] = useState<Record<string, string>>(() =>
      Object.fromEntries(
        Object.entries(error.rawRecord.payload).map(([key, value]) => [
          key,
          value === null || typeof value === "object" ? "" : String(value),
        ]),
      ),
    ),
    [newField, setNewField] = useState(""),
    [newValue, setNewValue] = useState(""),
    [busy, setBusy] = useState(false),
    [problem, setProblem] = useState("");
  return (
    <Dialog
      open
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
      title={`Correct row ${error.rawRecord.rowNumber}`}
      description={error.message}
      wide
    >
      <form
        className="edit-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setProblem("");
          try {
            await post(`/integrations/runs/${error.runId}/retry`, {
              corrections: [{ errorId: error.id, payload }],
            });
            toast.success("Selected row retried; review its result below");
            onDone();
            onClose();
          } catch (err) {
            setProblem(err instanceof Error ? err.message : "Retry failed.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="form-grid">
          {Object.entries(payload).map(([key, value]) => (
            <div className="field" key={key}>
              <Label htmlFor={`correct-${key}`}>
                {label(key.replace(/([a-z])([A-Z])/g, "$1 $2"))}
              </Label>
              <Input
                id={`correct-${key}`}
                value={value}
                maxLength={2000}
                onChange={(e) =>
                  setPayload({ ...payload, [key]: e.target.value })
                }
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  setPayload(
                    Object.fromEntries(
                      Object.entries(payload).filter(([k]) => k !== key),
                    ),
                  )
                }
              >
                Remove field
              </Button>
            </div>
          ))}
        </div>
        <details className="correction-fields">
          <summary>Add a missing field</summary>
          <div className="form-grid">
            <div className="field">
              <Label htmlFor="new-field">Canonical field name</Label>
              <Input
                id="new-field"
                maxLength={50}
                value={newField}
                onChange={(e) => setNewField(e.target.value)}
                placeholder="For example, enteredBy"
              />
            </div>
            <div className="field">
              <Label htmlFor="new-value">Field value</Label>
              <Input
                id="new-value"
                maxLength={2000}
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
              />
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={
              !/^[a-zA-Z][a-zA-Z0-9]{0,49}$/.test(newField) ||
              newField in payload
            }
            onClick={() => {
              setPayload({ ...payload, [newField]: newValue });
              setNewField("");
              setNewValue("");
            }}
          >
            Add field
          </Button>
        </details>
        <p className="small">
          Only this failed row is replayed. Successful rows remain loaded.
          Source timestamps must be newer when changing an existing canonical
          record.
        </p>
        {problem && <Alert title="Correction not saved">{problem}</Alert>}
        <div className="form-actions">
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? "Retrying…" : "Retry selected row"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
export function IntegrationsView({ user }: { user: User }) {
  const [page, setPage] = useState(1),
    [search, setSearch] = useState(""),
    [status, setStatus] = useState("all"),
    [adding, setAdding] = useState(false),
    [runId, setRunId] = useState<string | null>(null),
    [correction, setCorrection] = useState<ImportError | null>(null),
    [retrying, setRetrying] = useState(false);
  const q = new URLSearchParams({
      page: String(page),
      search,
      ...(status !== "all" ? { status } : {}),
    }),
    {
      data: sources,
      error: sourceError,
      mutate: mutateSources,
    } = useSWR<Envelope<Source[]>>("/integrations/sources"),
    {
      data: runs,
      error,
      isLoading,
      mutate,
    } = useSWR<Page<Run>>(`/integrations/runs?${q}`),
    {
      data: detail,
      error: detailError,
      mutate: mutateDetail,
    } = useSWR<Envelope<Run>>(runId ? `/integrations/runs/${runId}` : null),
    can = user.permissions.includes("integrations:write");
  const refresh = () => {
    mutate();
    mutateSources();
    mutateDetail();
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Source integrations</h1>
          <p>Follow each snapshot from extraction to canonical records.</p>
        </div>
        <div className="heading-actions">
          <Refresh refresh={refresh} />
          {can && (
            <Button
              onClick={() => setAdding(true)}
              disabled={!sources?.data.length}
            >
              <Upload size={16} />
              New import
            </Button>
          )}
        </div>
      </div>
      {sourceError && (
        <Alert title="Source registry unavailable">{sourceError.message}</Alert>
      )}
      <div className="integration-layout">
        <aside className="source-index">
          <h2>Connected sources</h2>
          <p>CSV and synthetic REST adapters</p>
          {sources?.data.map((source) => (
            <div key={source.id} className="source-index-row">
              <span className="source-code">{source.code}</span>
              <div>
                <strong>{source.name}</strong>
                <span>{source.method}</span>
                <small>{dateTime(source.lastSuccessAt)}</small>
              </div>
              <Status value={source.runs[0]?.status ?? "OPEN"} />
            </div>
          ))}
        </aside>
        <Card>
          <CardHeader>
            <div>
              <h2>Integration runs</h2>
              <p>Retries only replay quarantined records.</p>
            </div>
            <Select
              label="Run status"
              value={status}
              onValueChange={(v) => {
                setStatus(v);
                setPage(1);
              }}
              options={[
                { value: "all", label: "All statuses" },
                ...["SUCCEEDED", "PARTIAL", "FAILED", "RUNNING"].map((v) => ({
                  value: v,
                  label: v.toLowerCase(),
                })),
              ]}
            />
          </CardHeader>
          <div className="panel-filter">
            <SearchBox
              placeholder="Search source names"
              onSearch={(v) => {
                setSearch(v);
                setPage(1);
              }}
            />
          </div>
          <State loading={isLoading} error={error} retry={() => mutate()}>
            {runs && (
              <>
                {runs.data.length ? (
                  <Table>
                    <thead>
                      <tr>
                        <th>Source / started PHT</th>
                        <th>Status</th>
                        <th className="numeric">Loaded</th>
                        <th className="numeric">Quarantined</th>
                        <th className="numeric">Skipped</th>
                        <th>Duration</th>
                        <th>Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {runs.data.map((run) => (
                        <tr key={run.id}>
                          <td>
                            <strong>
                              {run.sourceSystem?.name ?? run.entity}
                            </strong>
                            <small>{dateTime(run.startedAt)}</small>
                          </td>
                          <td>
                            <Status value={run.status} />
                          </td>
                          <td className="numeric">{number(run.processed)}</td>
                          <td className="numeric">
                            {run.failed ? (
                              <Badge tone="error">{run.failed}</Badge>
                            ) : (
                              "0"
                            )}
                          </td>
                          <td className="numeric">{run.skipped}</td>
                          <td>
                            {run.finishedAt
                              ? `${number((new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime()) / 1000, 2)} s`
                              : "In progress"}
                          </td>
                          <td>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setRunId(run.id)}
                            >
                              Inspect
                              <ArrowUpRight size={14} />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                ) : (
                  <Empty title="No runs match these filters">
                    Change the status or source-name filter.
                  </Empty>
                )}
                <Pager data={runs} onPage={setPage} />
              </>
            )}
          </State>
        </Card>
      </div>
      {adding && (
        <ImportForm
          sources={sources?.data ?? []}
          onClose={() => setAdding(false)}
          onDone={(run) => {
            setRunId(run.id);
            refresh();
          }}
        />
      )}
      <Dialog
        open={!!runId}
        onOpenChange={(v) => {
          if (!v) setRunId(null);
        }}
        title="Import record trail"
        description="Loaded, skipped and quarantined outcomes from this snapshot."
        wide
      >
        {detailError ? (
          <Alert>{detailError.message}</Alert>
        ) : detail?.data ? (
          <>
            <div className="run-summary">
              <Status value={detail.data.status} />
              <span>
                {detail.data.totalRecords} total · {detail.data.processed}{" "}
                loaded · {detail.data.failed} quarantined ·{" "}
                {detail.data.skipped} skipped
              </span>
            </div>
            {detail.data.errors?.length ? (
              <div className="error-records">
                {detail.data.errors.map((err) => (
                  <div key={err.id} className="error-record">
                    <div>
                      <FileText size={19} />
                      <strong>
                        Row {err.rawRecord.rowNumber} ·{" "}
                        {err.rawRecord.sourceRecordId ?? "Missing source ID"}
                      </strong>
                      <Status value={err.remediation} />
                    </div>
                    <p>{err.message}</p>
                    <small>
                      {err.attempts} retry attempts · {err.code}
                    </small>
                    {can && err.remediation !== "RESOLVED" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCorrection(err)}
                      >
                        Correct and retry
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <Empty title="No quarantined records">
                Every record was loaded or skipped as unchanged.
              </Empty>
            )}
            {can && detail.data.failed > 0 && (
              <div className="form-actions">
                <Button
                  variant="outline"
                  disabled={retrying}
                  onClick={async () => {
                    setRetrying(true);
                    try {
                      await post(`/integrations/runs/${runId}/retry`, {});
                      refresh();
                      toast.success("Failed records retried");
                    } catch (err) {
                      toast.error(
                        err instanceof Error ? err.message : "Retry failed.",
                      );
                    } finally {
                      setRetrying(false);
                    }
                  }}
                >
                  <RotateCcw size={15} />
                  {retrying ? "Retrying…" : "Retry all failed records"}
                </Button>
              </div>
            )}
          </>
        ) : (
          <p>Loading record trail…</p>
        )}
      </Dialog>
      {correction && (
        <CorrectError
          key={correction.id}
          error={correction}
          onClose={() => setCorrection(null)}
          onDone={refresh}
        />
      )}
    </>
  );
}
