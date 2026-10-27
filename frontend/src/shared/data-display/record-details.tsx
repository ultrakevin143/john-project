"use client";

import { StructuredValue } from "@/shared/data-display/index";
import { label } from "@/shared/lib/utils";
import { type Row } from "@/shared/types";
import { Dialog,Empty } from "@/shared/ui/index";

export function RecordDetails({
  record,
  onClose,
  title = "Record details",
}: {
  record: Row | null;
  onClose: () => void;
  title?: string;
}) {
  return (
    <Dialog
      open={!!record}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
      title={title}
      description="Canonical values and source lineage"
      wide
    >
      {record ? (
        <dl className="record-details">
          {Object.entries(record).map(([key, value]) => (
            <div key={key}>
              <dt>{label(key.replace(/([a-z])([A-Z])/g, "$1 $2"))}</dt>
              <dd>
                <StructuredValue value={value} />
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <Empty title="No record selected">
          Choose a record to inspect its values.
        </Empty>
      )}
    </Dialog>
  );
}
