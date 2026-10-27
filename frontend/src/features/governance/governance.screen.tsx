"use client";

import { type Asset } from "@/features/governance/types";
import { api } from "@/shared/api/client";
import { type Envelope,type Page,type User } from "@/shared/api/contracts";
import { Pager,Refresh,SearchBox,State } from "@/shared/data-display/index";
import { RecordDetails } from "@/shared/data-display/record-details";
import { type Row } from "@/shared/types";
import {
Alert,
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
import { ArrowRight,Pencil } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";

export function PolicyEditor({
  asset,
  onDone,
  onClose,
}: {
  asset: Asset;
  onDone: () => void;
  onClose: () => void;
}) {
  const [owner, setOwner] = useState(asset.owner),
    [steward, setSteward] = useState(asset.steward),
    [classification, setClassification] = useState(asset.classification),
    [retention, setRetention] = useState(String(asset.retentionDays)),
    [policy, setPolicy] = useState(asset.policy),
    [reason, setReason] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <Dialog
      open
      title={`Govern ${asset.name}`}
      description="Ownership and policy changes are versioned and audited."
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <form
        className="edit-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await api(`/governance/assets/${asset.id}`, {
              method: "PATCH",
              body: JSON.stringify({
                owner,
                steward,
                classification,
                retentionDays: Number(retention),
                policy,
                reason,
                version: asset.version,
              }),
            });
            toast.success("Governance policy updated");
            onDone();
            onClose();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Unable to save.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="form-grid">
          <div className="field">
            <Label htmlFor="asset-owner">Data owner</Label>
            <Input
              id="asset-owner"
              required
              minLength={2}
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
            />
          </div>
          <div className="field">
            <Label htmlFor="asset-steward">Data steward</Label>
            <Input
              id="asset-steward"
              required
              minLength={2}
              value={steward}
              onChange={(e) => setSteward(e.target.value)}
            />
          </div>
        </div>
        <div className="form-grid">
          <div className="field">
            <Label>Classification</Label>
            <Select
              label="Classification"
              value={classification}
              onValueChange={setClassification}
              options={["PUBLIC", "INTERNAL", "CONFIDENTIAL", "RESTRICTED"].map(
                (v) => ({ value: v, label: v.toLowerCase() }),
              )}
            />
          </div>
          <div className="field">
            <Label htmlFor="retention">Retention days</Label>
            <Input
              id="retention"
              type="number"
              min={1}
              max={36500}
              required
              value={retention}
              onChange={(e) => setRetention(e.target.value)}
            />
          </div>
        </div>
        <div className="field">
          <Label htmlFor="policy">Retention / anonymization policy</Label>
          <Textarea
            id="policy"
            minLength={8}
            required
            value={policy}
            onChange={(e) => setPolicy(e.target.value)}
          />
        </div>
        <p className="small">
          Retention metadata does not automatically delete records. Customer
          identity and billing assets must remain restricted.
        </p>
        <div className="field">
          <Label htmlFor="policy-reason">Reason for change</Label>
          <Textarea
            id="policy-reason"
            required
            minLength={8}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        {error && <Alert title="Policy was not saved">{error}</Alert>}
        <div className="form-actions">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            Save policy
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
export function GovernanceView({ user }: { user: User }) {
  const [page, setPage] = useState(1),
    [search, setSearch] = useState(""),
    [domain, setDomain] = useState("all"),
    [classification, setClassification] = useState("all"),
    [selected, setSelected] = useState<Asset | null>(null),
    [detail, setDetail] = useState<Row | null>(null),
    { data: domains } = useSWR<
      Envelope<
        {
          id: string;
          name: string;
          owner: string;
          steward: string;
          description: string;
        }[]
      >
    >("/governance/domains"),
    q = new URLSearchParams({
      page: String(page),
      search,
      ...(domain !== "all" ? { domainId: domain } : {}),
      ...(classification !== "all" ? { classification } : {}),
    }),
    { data, error, isLoading, mutate } = useSWR<Page<Asset>>(
      `/governance/assets?${q}`,
    );
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Governance catalog</h1>
          <p>
            Ownership, classification and policy across the district’s data
            domains.
          </p>
        </div>
        <Refresh refresh={() => mutate()} />
      </div>
      <div className="lineage-band">
        <span>Source systems</span>
        <ArrowRight size={18} />
        <span>Validated canonical data</span>
        <ArrowRight size={18} />
        <span>Owned & classified assets</span>
        <ArrowRight size={18} />
        <span>Operational outputs</span>
      </div>
      <Card>
        <CardHeader className="table-toolbar">
          <SearchBox
            placeholder="Search governed assets"
            onSearch={(v) => {
              setSearch(v);
              setPage(1);
            }}
          />
          <div className="toolbar-controls">
            <Select
              label="Data domain"
              value={domain}
              onValueChange={(v) => {
                setDomain(v);
                setPage(1);
              }}
              options={[
                { value: "all", label: "All domains" },
                ...(domains?.data ?? []).map((d) => ({
                  value: d.id,
                  label: d.name,
                })),
              ]}
            />
            <Select
              label="Asset classification"
              value={classification}
              onValueChange={(v) => {
                setClassification(v);
                setPage(1);
              }}
              options={[
                { value: "all", label: "All classifications" },
                ...["PUBLIC", "INTERNAL", "CONFIDENTIAL", "RESTRICTED"].map(
                  (v) => ({ value: v, label: v.toLowerCase() }),
                ),
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
                      <th>Asset / source</th>
                      <th>Domain</th>
                      <th>Owner / steward</th>
                      <th>Classification</th>
                      <th className="numeric">Retention days</th>
                      <th>Policy</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.data.map((asset) => (
                      <tr key={asset.id}>
                        <td>
                          <button
                            className="table-link"
                            onClick={() => setDetail(asset as unknown as Row)}
                          >
                            {asset.name}
                          </button>
                          <small>
                            {asset.sourceSystem.name} ·{" "}
                            {asset.sourceSystem.method}
                          </small>
                        </td>
                        <td>{asset.domain.name}</td>
                        <td>
                          {asset.owner}
                          <small>{asset.steward}</small>
                        </td>
                        <td>
                          <Status value={asset.classification} />
                          {asset.containsPii && (
                            <small>Contains identity data</small>
                          )}
                        </td>
                        <td className="numeric">
                          {asset.retentionDays.toLocaleString()}
                        </td>
                        <td>
                          {user.permissions.includes("governance:write") ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelected(asset)}
                            >
                              <Pencil size={14} />
                              Edit policy
                            </Button>
                          ) : (
                            <span>Version {asset.version}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              ) : (
                <Empty title="No matching assets">
                  Choose a different domain or classification.
                </Empty>
              )}
              <Pager data={data} onPage={setPage} />
            </>
          )}
        </State>
      </Card>
      <div className="domain-register">
        <h2>Domain accountability</h2>
        {(domains?.data ?? [])
          .filter((d) => domain === "all" || domain === d.id)
          .map((d) => (
            <div key={d.id}>
              <h3>{d.name}</h3>
              <p>{d.description}</p>
              <span>
                Owner: {d.owner} · Steward: {d.steward}
              </span>
            </div>
          ))}
      </div>
      <RecordDetails
        title="Governed asset and rule coverage"
        record={detail}
        onClose={() => setDetail(null)}
      />
      {selected && (
        <PolicyEditor
          key={selected.id}
          asset={selected}
          onClose={() => setSelected(null)}
          onDone={() => mutate()}
        />
      )}
    </>
  );
}
