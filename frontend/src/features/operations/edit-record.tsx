"use client";

import { type Lookups } from "@/features/operations/types";
import { api } from "@/shared/api/client";
import { type Row } from "@/shared/types";
import {
Alert,
Button,
Dialog,
Input,
Label,
Select,
Textarea,
} from "@/shared/ui/index";
import { useState } from "react";
import { toast } from "sonner";

export function EditRecord({
  row,
  entity,
  lookups,
  onDone,
  onClose,
}: {
  row: Row;
  entity: string;
  lookups?: Lookups;
  onDone: () => void;
  onClose: () => void;
}) {
  const lab = entity === "water-quality",
    [value, setValue] = useState(String(row.value ?? "")),
    [action, setAction] = useState(String(row.correctiveActionId ?? "none")),
    [status, setStatus] = useState(String(row.status ?? "OPEN")),
    [reason, setReason] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const next: Record<string, string[]> = {
    OPEN: entity === "complaints" ? ["ASSIGNED"] : ["DISPATCHED"],
    DISPATCHED: ["OPEN", "IN_PROGRESS"],
    IN_PROGRESS: ["COMPLETED"],
    COMPLETED: ["CLOSED"],
    ASSIGNED: ["OPEN", "RESOLVED"],
    RESOLVED: ["ASSIGNED", "CLOSED"],
    CLOSED: [],
  };
  return (
    <Dialog
      open
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
      title={lab ? "Correct laboratory result" : "Update response status"}
      description="Changes require a reason and are preserved in the audit trail."
    >
      <form
        className="edit-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            const now = new Date().toISOString();
            const body = lab
              ? {
                  value: Number(value),
                  unit: String(row.unit),
                  correctiveActionId: action === "none" ? null : action,
                  version: Number(row.correctionVersion),
                  reason,
                }
              : {
                  status,
                  updatedAt: row.updatedAt,
                  reason,
                  ...(status === "DISPATCHED" ? { dispatchedAt: now } : {}),
                  ...(["COMPLETED", "CLOSED"].includes(status) &&
                  !row.completedAt &&
                  entity === "work-orders"
                    ? { completedAt: now }
                    : {}),
                  ...(["RESOLVED", "CLOSED"].includes(status) &&
                  !row.resolvedAt &&
                  entity === "complaints"
                    ? { resolvedAt: now }
                    : {}),
                };
            await api(
              `/operations/${entity}/${row.id}${lab ? "" : "/status"}`,
              { method: "PATCH", body: JSON.stringify(body) },
            );
            toast.success(
              lab
                ? "Lab correction saved with audit history"
                : "Response status updated",
            );
            onDone();
            onClose();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Unable to save.");
          } finally {
            setBusy(false);
          }
        }}
      >
        {lab ? (
          <>
            <div className="field">
              <Label htmlFor="lab-value">Result ({String(row.unit)})</Label>
              <Input
                id="lab-value"
                type="number"
                step="any"
                required
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            </div>
            <div className="field">
              <Label>Corrective work order</Label>
              <Select
                label="Corrective work order"
                value={action}
                onValueChange={setAction}
                options={[
                  { value: "none", label: "No linked action" },
                  ...(lookups?.workOrders ?? []).map((w) => ({
                    value: w.id,
                    label: `${w.reference} · ${w.title}`,
                  })),
                ]}
              />
            </div>
            <p className="small">
              Parameter units are fixed. A limit breach remains visible when an
              action is linked.
            </p>
          </>
        ) : (
          <div className="field">
            <Label>Next status</Label>
            <Select
              label="Next status"
              value={status}
              onValueChange={setStatus}
              options={[
                String(row.status),
                ...(next[String(row.status)] ?? []),
              ].map((v) => ({
                value: v,
                label: v.toLowerCase().replaceAll("_", " "),
              }))}
            />
            <p className="small">
              Dispatch, completion or resolution time is recorded when the
              status changes. Completing a leak-repair work order also resolves
              its linked leak reports.
            </p>
          </div>
        )}
        <div className="field">
          <Label htmlFor="change-reason">Reason for change</Label>
          <Textarea
            id="change-reason"
            required
            minLength={8}
            maxLength={500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Describe the verified correction or field update"
          />
        </div>
        {error && <Alert title="Change was not saved">{error}</Alert>}
        <div className="form-actions">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? "Saving…" : "Save audited change"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
