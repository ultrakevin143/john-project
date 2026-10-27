"use client";

import { type Page } from "@/shared/api/contracts";
import { dateTime,label,number } from "@/shared/lib/utils";
import { Alert,Button,Input,Loading } from "@/shared/ui/index";
import { ArrowLeft,ArrowRight,RefreshCw,Search } from "lucide-react";
import { useState } from "react";

export function Problem({ error, retry }: { error: Error; retry: () => void }) {
  return (
    <Alert title="Data could not be loaded">
      <p>{error.message}</p>
      <Button variant="outline" onClick={retry}>
        Load again
      </Button>
    </Alert>
  );
}
export function State({
  loading,
  error,
  retry,
  children,
}: {
  loading: boolean;
  error?: Error;
  retry: () => void;
  children: React.ReactNode;
}) {
  return error ? (
    <Problem error={error} retry={retry} />
  ) : loading ? (
    <Loading />
  ) : (
    <>{children}</>
  );
}
export function Refresh({
  refresh,
  busy = false,
}: {
  refresh: () => void;
  busy?: boolean;
}) {
  return (
    <Button variant="outline" onClick={refresh} disabled={busy}>
      <RefreshCw size={15} />
      Refresh
    </Button>
  );
}
export function SearchBox({
  onSearch,
  placeholder = "Search records",
}: {
  onSearch: (value: string) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");
  return (
    <form
      className="search"
      onSubmit={(e) => {
        e.preventDefault();
        onSearch(draft);
      }}
    >
      <Search size={16} />
      <Input
        aria-label={placeholder}
        placeholder={placeholder}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
      />
      <Button variant="ghost" size="sm" type="submit">
        Search
      </Button>
    </form>
  );
}
export function Pager({
  data,
  onPage,
}: {
  data: Pick<Page<unknown>, "pagination">;
  onPage: (page: number) => void;
}) {
  const p = data.pagination;
  return (
    <div className="pager">
      <span>
        {number(p.total)} records · Page {p.page} of {Math.max(1, p.pages)}
      </span>
      <div>
        <Button
          variant="ghost"
          size="sm"
          disabled={p.page <= 1}
          onClick={() => onPage(p.page - 1)}
          aria-label="Previous page"
        >
          <ArrowLeft size={16} />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={p.page >= p.pages}
          onClick={() => onPage(p.page + 1)}
          aria-label="Next page"
        >
          <ArrowRight size={16} />
        </Button>
      </div>
    </div>
  );
}
export function display(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") return "Structured details";
  if (typeof value === "string" && /^\d{4}-\d\d-\d\dT/.test(value))
    return dateTime(value);
  return String(value);
}
export function StructuredValue({
  value,
  depth = 0,
}: {
  value: unknown;
  depth?: number;
}): React.ReactNode {
  if (value === null || typeof value !== "object") return display(value);
  if (depth > 4)
    return (
      <span className="small">
        Further details available in the source record.
      </span>
    );
  if (Array.isArray(value))
    return value.length ? (
      <ul className="structured-list">
        {value.slice(0, 20).map((item, index) => (
          <li
            key={
              typeof item === "object" && item && "id" in item
                ? String(item.id)
                : index
            }
          >
            <StructuredValue value={item} depth={depth + 1} />
          </li>
        ))}
      </ul>
    ) : (
      <span className="small">No entries</span>
    );
  return (
    <dl className="structured-fields">
      {Object.entries(value).map(([key, item]) => (
        <div key={key}>
          <dt>{label(key.replace(/([a-z])([A-Z])/g, "$1 $2"))}</dt>
          <dd>
            <StructuredValue value={item} depth={depth + 1} />
          </dd>
        </div>
      ))}
    </dl>
  );
}
export function PeriodLabel({ from, to }: { from: string; to: string }) {
  const format = (s: string) =>
    new Intl.DateTimeFormat("en-PH", {
      dateStyle: "medium",
      timeZone: "Asia/Manila",
    }).format(new Date(s));
  return (
    <span>
      {format(from)} —{" "}
      {format(new Date(new Date(to).getTime() - 86400000).toISOString())}
    </span>
  );
}
