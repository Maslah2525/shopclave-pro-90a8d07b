import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useOutletContext, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Truck, FileText, ExternalLink, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import TrackingTimeline, { SHIPMENT_STATUS_LABELS } from "@/components/shipping/TrackingTimeline";

// Vendors may only advance these three statuses; the rest come from the carrier.
const VENDOR_FLOW = ["preparing", "ready_for_pickup", "collected"];

const VendorShipments = () => {
  const { vendor } = useOutletContext<{ vendor: any }>();
  const queryClient = useQueryClient();
  const [manual, setManual] = useState<Record<string, { carrier: string; tracking: string; reference: string }>>({});

  const { data } = useQuery({
    queryKey: ["vendor-shipments", vendor?.id],
    enabled: !!vendor,
    queryFn: async () => {
      const { data: shipments } = await supabase
        .from("shipments")
        .select("*, orders(created_at, payment_status, shipping_address), shipment_items(order_item_id)")
        .eq("vendor_id", vendor.id)
        .order("created_at", { ascending: false });

      const ids = (shipments || []).map((s: any) => s.id);
      const { data: events } = ids.length
        ? await supabase.from("tracking_events").select("*").in("shipment_id", ids)
        : { data: [] as any[] };

      return { shipments: shipments || [], events: events || [] };
    },
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("shipments").update({ status }).eq("id", id).eq("vendor_id", vendor.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-shipments"] });
      toast.success("Shipment updated");
    },
    onError: (e: any) => toast.error(e.message || "Could not update shipment"),
  });

  const saveManual = useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const v = manual[id] || { carrier: "", tracking: "", reference: "" };
      if (!v.carrier.trim() || (!v.tracking.trim() && !v.reference.trim())) throw new Error("Enter a carrier and a tracking or booking reference.");
      const { error } = await supabase.from("shipments").update({
        manual_carrier: v.carrier.trim(),
        manual_tracking_number: v.tracking.trim() || null,
        manual_booking_reference: v.reference.trim() || null,
        manual_booked_at: new Date().toISOString(),
        carrier: v.carrier.trim(),
        tracking_number: v.tracking.trim() || null,
        status: "collected",
      }).eq("id", id).eq("vendor_id", vendor.id).eq("fulfilment_mode", "manual");
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["vendor-shipments"] }); toast.success("Manual carrier booking recorded"); },
    onError: (e: any) => toast.error(e.message || "Could not record carrier booking"),
  });

  const shipments = data?.shipments || [];

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Fulfilment"
        subtitle="Prepare parcels, print labels and follow every delivery."
        count={shipments.length}
        countLabel="parcels"
      />

      {!shipments.length ? (
        <div className="admin-card">
          <AdminEmptyState
            icon={Truck}
            title="No parcels yet"
            description="Parcels appear here as soon as a customer pays for one of your products."
          />
        </div>
      ) : (
        <div className="space-y-3">
          {shipments.map((s: any) => {
            const idx = VENDOR_FLOW.indexOf(s.status);
            const next = idx > -1 && idx < VENDOR_FLOW.length - 1 ? VENDOR_FLOW[idx + 1] : null;
            const addr = s.orders?.shipping_address as any;
            const sEvents = (data?.events || []).filter((e: any) => e.shipment_id === s.id);
            return (
              <div key={s.id} className="admin-card p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-sm">
                      Order <span className="font-mono">#{s.order_id.slice(0, 8)}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {s.carrier ? `${s.carrier}${s.service ? ` • ${s.service}` : ""}` : "Carrier pending"}
                      {addr?.city ? ` → ${addr.city}` : ""}
                    </p>
                  </div>
                  <span className="status-pill bg-primary/10 text-primary">
                    {SHIPMENT_STATUS_LABELS[s.status] || s.status}
                  </span>
                </div>

                {s.fulfilment_mode === "manual" && (
                  <div className="text-xs bg-warning/10 text-warning rounded p-3 flex gap-2 items-start">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <div><strong>Manual carrier booking required.</strong><br />Arrange collection directly with a carrier, then record the carrier and tracking/reference details before marking the parcel collected.</div>
                  </div>
                )}

                {s.fulfilment_mode === "manual" && s.status === "manual_booking_required" && (
                  <div className="grid gap-2 sm:grid-cols-3">
                    <Input placeholder="Carrier *" value={manual[s.id]?.carrier || ""} onChange={(e) => setManual((m) => ({ ...m, [s.id]: { carrier: e.target.value, tracking: m[s.id]?.tracking || "", reference: m[s.id]?.reference || "" } }))} />
                    <Input placeholder="Tracking number" value={manual[s.id]?.tracking || ""} onChange={(e) => setManual((m) => ({ ...m, [s.id]: { carrier: m[s.id]?.carrier || "", tracking: e.target.value, reference: m[s.id]?.reference || "" } }))} />
                    <Input placeholder="Booking reference" value={manual[s.id]?.reference || ""} onChange={(e) => setManual((m) => ({ ...m, [s.id]: { carrier: m[s.id]?.carrier || "", tracking: m[s.id]?.tracking || "", reference: e.target.value } }))} />
                    <div className="sm:col-span-3"><Button size="sm" onClick={() => saveManual.mutate({ id: s.id })} disabled={saveManual.isPending}>Confirm carrier booking & collection</Button></div>
                  </div>
                )}

                {s.label_error && (
                  <p className="text-xs text-destructive bg-destructive/10 rounded p-2">
                    Label problem: {s.label_error}
                  </p>
                )}

                <div className="flex flex-wrap gap-2">
                  {next && s.fulfilment_mode !== "manual" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => setStatus.mutate({ id: s.id, status: next })}
                    >
                      Mark {SHIPMENT_STATUS_LABELS[next]}
                    </Button>
                  )}
                  {s.label_url && (
                    <a href={s.label_url} target="_blank" rel="noreferrer">
                      <Button size="sm" variant="ghost" className="h-7 text-xs gap-1">
                        <FileText className="h-3 w-3" /> Print label
                      </Button>
                    </a>
                  )}
                  {s.tracking_url && (
                    <a href={s.tracking_url} target="_blank" rel="noreferrer">
                      <Button size="sm" variant="ghost" className="h-7 text-xs gap-1">
                        <ExternalLink className="h-3 w-3" /> Track
                      </Button>
                    </a>
                  )}
                  <Link to={`/orders/${s.order_id}/chat`}>
                    <Button size="sm" variant="ghost" className="h-7 text-xs">
                      Chat with buyer
                    </Button>
                  </Link>
                  {s.shipment_items?.map((link: { order_item_id: string }, index: number) => (
                    <Button key={link.order_item_id} size="sm" variant="outline" asChild>
                      <Link to={`/vendor/orders/${link.order_item_id}`}>Update item delivery{(s.shipment_items?.length ?? 0) > 1 ? ` ${index + 1}` : ""}</Link>
                    </Button>
                  ))}
                </div>

                {sEvents.length > 0 && (
                  <div className="pt-2 border-t border-border">
                    <TrackingTimeline events={sEvents} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default VendorShipments;
