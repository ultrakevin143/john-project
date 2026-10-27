"use client";

import { post } from "@/shared/api/client";
import { type Envelope,type User } from "@/shared/api/contracts";
import { Refresh,State } from "@/shared/data-display/index";
import { dateTime,number,pesos } from "@/shared/lib/utils";
import {
Alert,
Badge,
Button,
Card,
CardHeader,
Dialog,
Input,
Label,
Table,
Textarea,
} from "@/shared/ui/index";
import { Plus,Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";

export type Tariff = {
  id: string;
  code: string;
  name: string;
  customerClass: string;
  meterSizeMm: number;
  currency: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  baseVolumeM3: string;
  baseCharge: string;
  ratePerM3: string;
  blocks: {
    upToM3: number | null;
    rate: number;
  }[];
  sourceLabel: string;
};
export type Reference = {
  profile: {
    name: string;
    timezone: string;
    currency: string;
    referenceUtility: string;
    referenceUrl: string;
    notice: string;
    geographyNotice: string;
    geographyUrl: string;
    privacyUrl: string;
    privacyNotice: string;
  };
  areas: {
    id: string;
    code: string;
    name: string;
    city: string;
    barangay: string;
    barangayPsgc: string;
  }[];
  tariffs: Tariff[];
  parameters: {
    id: string;
    name: string;
    unit: string;
    limitMin: number;
    limitMax: number;
    method: string;
    standardCode: string;
    standardUrl: string;
    referenceSection: string;
    monitoringIntervalHours: number;
    guidance: string;
  }[];
};
export const volume = (value: number) =>
  new Intl.NumberFormat("en-PH", { maximumFractionDigits: 3 }).format(value);
export const unitRate = (value: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(value);
export function TariffEditor({
  prior,
  onClose,
  onDone,
}: {
  prior: Tariff;
  onClose: () => void;
  onDone: () => void;
}) {
  const [code, setCode] = useState(""),
    [name, setName] = useState(""),
    [from, setFrom] = useState(""),
    [base, setBase] = useState(prior.baseCharge),
    [included, setIncluded] = useState(prior.baseVolumeM3),
    [blocks, setBlocks] = useState(
      prior.blocks.length
        ? prior.blocks.map((b) => ({
            upper: b.upToM3 === null ? "" : String(b.upToM3),
            rate: String(b.rate),
          }))
        : [{ upper: "", rate: prior.ratePerM3 }],
    ),
    [reason, setReason] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <Dialog
      open
      title="Create a tariff version"
      description={`Supersedes ${prior.code}. Existing bills retain their tariff reference.`}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
      wide
    >
      <form
        className="edit-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          setBusy(true);
          try {
            await post("/reference/tariffs", {
              supersedesId: prior.id,
              code: code.toUpperCase(),
              name,
              effectiveFrom: from,
              baseVolumeM3: Number(included),
              baseCharge: Number(base),
              ratePerM3: Number(blocks.at(-1)?.rate ?? 0),
              blocks: blocks.map((b) => ({
                upToM3: b.upper ? Number(b.upper) : null,
                rate: Number(b.rate),
              })),
              reason,
            });
            toast.success("Tariff version saved with audit history");
            onDone();
            onClose();
          } catch (err) {
            setError(
              err instanceof Error ? err.message : "Tariff could not be saved.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="form-grid">
          <div className="field">
            <Label htmlFor="tariff-code">Version code</Label>
            <Input
              id="tariff-code"
              required
              pattern="[A-Za-z0-9-]{3,30}"
              maxLength={30}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="RES-2027"
            />
          </div>
          <div className="field">
            <Label htmlFor="tariff-name">Version name</Label>
            <Input
              id="tariff-name"
              required
              minLength={3}
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="field">
            <Label htmlFor="tariff-from">Effective date (Manila)</Label>
            <Input
              id="tariff-from"
              type="date"
              required
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div className="field">
            <Label htmlFor="tariff-base">Minimum water charge (PHP)</Label>
            <Input
              id="tariff-base"
              type="number"
              required
              min={0}
              step="0.01"
              value={base}
              onChange={(e) => setBase(e.target.value)}
            />
          </div>
          <div className="field">
            <Label htmlFor="tariff-included">Included volume (m³)</Label>
            <Input
              id="tariff-included"
              type="number"
              required
              min={0}
              step="0.001"
              value={included}
              onChange={(e) => setIncluded(e.target.value)}
            />
          </div>
        </div>
        <fieldset className="tariff-brackets">
          <legend>Consumption above the included volume</legend>
          {blocks.map((b, i) => (
            <div className="tariff-bracket" key={i}>
              <div className="field">
                <Label htmlFor={`upper-${i}`}>
                  Bracket {i + 1} ends at (m³)
                </Label>
                <Input
                  id={`upper-${i}`}
                  type="number"
                  min={0.001}
                  step="0.001"
                  placeholder="No upper limit"
                  value={b.upper}
                  onChange={(e) =>
                    setBlocks(
                      blocks.map((item, n) =>
                        n === i ? { ...item, upper: e.target.value } : item,
                      ),
                    )
                  }
                />
              </div>
              <div className="field">
                <Label htmlFor={`rate-${i}`}>Rate (PHP/m³)</Label>
                <Input
                  id={`rate-${i}`}
                  type="number"
                  required
                  min={0}
                  step="0.0001"
                  value={b.rate}
                  inputMode="decimal"
                  onChange={(e) =>
                    setBlocks(
                      blocks.map((item, n) =>
                        n === i ? { ...item, rate: e.target.value } : item,
                      ),
                    )
                  }
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remove bracket ${i + 1}`}
                disabled={blocks.length === 1}
                onClick={() => setBlocks(blocks.filter((_, n) => n !== i))}
              >
                <Trash2 size={16} />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={blocks.length >= 20}
            onClick={() => setBlocks([...blocks, { upper: "", rate: "0" }])}
          >
            <Plus size={14} />
            Add bracket
          </Button>
        </fieldset>
        <p className="small">
          Leave only the final upper limit blank. The previous version ends on
          the new effective date. Import future accounts and bills with the new
          tariff reference; no records are reassigned automatically.
          Illustrative water charges exclude taxes, discounts and other fees.
        </p>
        <div className="field">
          <Label htmlFor="tariff-reason">Reason for the new version</Label>
          <Textarea
            id="tariff-reason"
            required
            minLength={8}
            maxLength={500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        {error && <Alert title="Tariff was not saved">{error}</Alert>}
        <div className="form-actions">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? "Saving…" : "Save illustrative version"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
export function ReferenceView({ user }: { user: User }) {
  const { data, error, isLoading, mutate } =
      useSWR<Envelope<Reference>>("/reference"),
    [editing, setEditing] = useState<Tariff | null>(null),
    d = data?.data;
  const canVersion =
    user.permissions.includes("governance:write") &&
    user.permissions.includes("domain:billing");
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Reference setup</h1>
          <p>
            Cebu locations, water-quality references and illustrative peso
            tariffs.
          </p>
        </div>
        <Refresh refresh={() => mutate()} busy={isLoading} />
      </div>
      <State loading={isLoading} error={error} retry={() => mutate()}>
        {d && (
          <div className="reference-stack">
            <section className="reference-intro">
              <h2>{d.profile.name}</h2>
              <p>{d.profile.notice}</p>
              <p>
                {d.profile.timezone} · PHP · m³ consumption · L/s flow · bar
                pressure
              </p>
              <p>
                Operational reference:{" "}
                <a
                  href={d.profile.referenceUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  {d.profile.referenceUtility}
                </a>
              </p>
            </section>
            <Card>
              <CardHeader>
                <div>
                  <h2>Demo supply areas</h2>
                  <p>{d.profile.geographyNotice}</p>
                </div>
                <a
                  href={d.profile.geographyUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-link"
                >
                  PSA location reference
                </a>
              </CardHeader>
              <Table>
                <thead>
                  <tr>
                    <th>Area</th>
                    <th>City</th>
                    <th>Barangay</th>
                    <th>Barangay PSGC</th>
                  </tr>
                </thead>
                <tbody>
                  {d.areas.map((a) => (
                    <tr key={a.id}>
                      <td>
                        {a.code} · {a.name}
                      </td>
                      <td>{a.city}</td>
                      <td>{a.barangay}</td>
                      <td>{a.barangayPsgc}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card>
            {d.parameters.length > 0 && (
              <Card>
                <CardHeader>
                  <div>
                    <h2>Water-quality reference limits</h2>
                    <p>
                      Four treated-water parameters; each comparison retains its
                      standard and method.
                    </p>
                  </div>
                  <Badge tone="info">PNSDW 2017 reference</Badge>
                </CardHeader>
                <Table>
                  <thead>
                    <tr>
                      <th>Parameter / method</th>
                      <th>Reference limits</th>
                      <th>Source</th>
                      <th>Demo reminder</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.parameters.map((p) => (
                      <tr key={p.id}>
                        <td>
                          {p.name}
                          <small>{p.method}</small>
                        </td>
                        <td>
                          {p.limitMin}–{p.limitMax} {p.unit}
                        </td>
                        <td>
                          <a
                            href={p.standardUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {p.standardCode}
                          </a>
                          <small>{p.referenceSection}</small>
                        </td>
                        <td>Every {number(p.monitoringIntervalHours)} hours</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
                <p className="formula">
                  {d.parameters[0]!.guidance} Total-coliform values here use
                  integer membrane-filtration counts; MPN and presence/absence
                  results need their own method configuration.
                </p>
              </Card>
            )}
            {d.tariffs.length > 0 && (
              <Card>
                <CardHeader>
                  <div>
                    <h2>Illustrative tariff versions</h2>
                    <p>
                      Base charge plus progressive consumption brackets, in PHP.
                      Effective dates use Manila time.
                    </p>
                  </div>
                  <Badge tone="warning">Not MCWD rates</Badge>
                </CardHeader>
                <Table>
                  <thead>
                    <tr>
                      <th>Version / class</th>
                      <th>Effective period</th>
                      <th>Minimum charge</th>
                      <th>Additional consumption</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.tariffs.map((t) => (
                      <tr key={t.id}>
                        <td>
                          <strong>{t.code}</strong> · {t.name}
                          <small>
                            {t.customerClass.toLowerCase()} · {t.meterSizeMm} mm
                            meter
                          </small>
                        </td>
                        <td>
                          {dateTime(t.effectiveFrom)}
                          <small>
                            Until{" "}
                            {t.effectiveTo
                              ? dateTime(t.effectiveTo) + " (exclusive)"
                              : "superseded"}
                          </small>
                        </td>
                        <td>
                          {pesos(Number(t.baseCharge))}
                          <small>
                            Includes {volume(Number(t.baseVolumeM3))} m³
                          </small>
                        </td>
                        <td>
                          <ul className="tariff-lines">
                            {t.blocks.length ? (
                              t.blocks.map((b, i) => (
                                <li key={i}>
                                  {volume(
                                    i
                                      ? t.blocks[i - 1]!.upToM3!
                                      : Number(t.baseVolumeM3),
                                  )}
                                  {b.upToM3 === null
                                    ? "+"
                                    : `–${volume(b.upToM3)}`}{" "}
                                  m³: {unitRate(b.rate)}/m³
                                </li>
                              ))
                            ) : (
                              <li>
                                Above included volume:{" "}
                                {unitRate(Number(t.ratePerM3))}/m³
                              </li>
                            )}
                          </ul>
                        </td>
                        <td>
                          {canVersion && !t.effectiveTo ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setEditing(t)}
                            >
                              New version
                            </Button>
                          ) : (
                            "Read only"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
                <p className="formula">
                  Rates are synthetic examples, not copied from an official MCWD
                  schedule. Water charges exclude taxes, discounts, penalties
                  and other fees. Version changes are audited; historic bills
                  keep their original tariff reference.
                </p>
              </Card>
            )}
            <section className="reference-intro">
              <h2>Data ownership and privacy</h2>
              <p>{d.profile.privacyNotice}</p>
              <p>
                Billing, laboratory, plant and field access follow
                server-enforced roles. Customer identities are masked;
                corrections and exports are audited.{" "}
                <a href={d.profile.privacyUrl} target="_blank" rel="noreferrer">
                  Read the Philippine Data Privacy Act
                </a>
                .
              </p>
              <p>
                Privacy controls support governance; this prototype does not
                claim legal certification or automatic retention enforcement.
              </p>
            </section>
          </div>
        )}
      </State>
      {editing && (
        <TariffEditor
          prior={editing}
          onClose={() => setEditing(null)}
          onDone={() => {
            void mutate();
          }}
        />
      )}
    </>
  );
}
