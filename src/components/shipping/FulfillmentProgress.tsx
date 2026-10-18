import { Check, PackageCheck, Package, Truck, ClipboardCheck } from "lucide-react";
import { FULFILLMENT_STAGES as STAGES, fulfillmentStageIndex } from "@/lib/fulfillmentProgress";

export const fulfillmentStageLabel = (status: string) =>
  STAGES.find((stage) => stage.value === status)?.label ?? status.replace(/_/g, " ");

const FulfillmentProgress = ({ status, compact = false, shipmentStatuses = [] }: { status: string; compact?: boolean; shipmentStatuses?: string[] }) => {
  const current = fulfillmentStageIndex(status, shipmentStatuses);
  if (current < 0) return <p className="text-sm font-medium capitalize">{fulfillmentStageLabel(status)}</p>;

  return (
    <div className="w-full min-w-0 space-y-3" aria-label={`Fulfillment stage: ${STAGES[current].label}`}>
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">Current: {STAGES[current].label}</span>
        <span className="text-xs text-muted-foreground">Step {current + 1} of {STAGES.length}</span>
      </div>
      <ol className="grid grid-cols-3 gap-x-2 gap-y-4 sm:grid-cols-6">
        {STAGES.map(({ value, label }, i) => {
          const Icon = i === 0 ? ClipboardCheck : i === 5 ? PackageCheck : i >= 3 ? Truck : Package;
          const complete = i < current;
          const active = i === current;
          return (
            <li key={value} className="flex min-w-0 flex-col items-center gap-1.5 text-center" aria-current={active ? "step" : undefined}>
              <div className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors ${complete ? "border-primary bg-primary text-primary-foreground" : active ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/20" : "border-border bg-muted/40 text-muted-foreground"}`}>
                {complete ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
              </div>
              <span className={`text-[10px] sm:text-xs leading-tight ${active ? "font-bold text-primary" : complete ? "font-medium text-foreground" : "text-muted-foreground"}`}>{label}</span>
            </li>
          );
        })}
      </ol>
      {!compact && <p className="text-xs text-muted-foreground">{current === 0 ? "Waiting for the seller to start preparing the order." : current === 1 ? "The seller is preparing the parcel for dispatch." : current === 2 ? "The parcel is ready for collection." : current === 3 ? "The item has shipped. Carrier updates are shown separately when available." : current === 4 ? "The parcels are out for delivery or have arrived; delivery of the whole item is not yet confirmed by the seller." : "The seller has marked the item as delivered."}</p>}
    </div>
  );
};

export default FulfillmentProgress;
