const STAGES = [
  { value: "pending", label: "Order received" },
  { value: "processing", label: "Preparing order" },
  { value: "shipped", label: "Shipped" },
  { value: "delivered", label: "Delivered" },
] as const;

const FulfillmentProgress = ({ status, compact = false }: { status: string; compact?: boolean }) => {
  const index = STAGES.findIndex((stage) => stage.value === status);
  if (index < 0) {
    return <span className="text-xs text-muted-foreground capitalize">{status.replace(/_/g, " ")}</span>;
  }

  return (
    <div aria-label={`Order fulfillment: ${STAGES[index].label}`} className="min-w-[145px] space-y-1.5">
      <div className="flex gap-1" aria-hidden="true">
        {STAGES.map((stage, i) => (
          <span key={stage.value} className={`h-1.5 flex-1 rounded-full ${i <= index ? "bg-primary" : "bg-muted"}`} />
        ))}
      </div>
      <p className="text-xs font-medium">{STAGES[index].label}</p>
      {!compact && <p className="text-[11px] text-muted-foreground">
        {index === 0 ? "Seller has received the order" : index === 1 ? "Seller is preparing your parcel" : index === 2 ? "Seller marked the parcel as shipped" : "Seller marked the order as delivered"}
      </p>}
    </div>
  );
};

export default FulfillmentProgress;
