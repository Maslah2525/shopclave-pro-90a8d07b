import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { CheckCircle2, Circle, Send } from "lucide-react";
import { toast } from "sonner";
import { storeSetupChecklist } from "@/lib/storeSetup";

export default function StoreSetupSubmitCard({ vendor, allStepsDone = false }: { vendor: any; allStepsDone?: boolean }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  if (!vendor || vendor.status === "approved") return null;
  const items = storeSetupChecklist(vendor);
  const ready = allStepsDone && items.every((i) => i.done);
  const submitted = !!vendor.submitted_for_review_at && vendor.status === "pending";

  const submit = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("submit_vendor_for_review");
    setBusy(false);
    if (error) { toast.error(error.message || "Could not submit. Please try again."); return; }
    setOpen(true);
    qc.invalidateQueries({ queryKey: ["vendor"] });
  };

  return (
    <div className="rounded-xl border-2 border-primary/40 bg-primary/5 p-4 space-y-3">
      <div>
        <h3 className="font-semibold">{submitted ? "Application under review" : "Finish your store setup to proceed"}</h3>
        <p className="text-xs text-muted-foreground">{submitted ? "We'll email you once your store is approved." : "Save these details below, then submit your store for review."}</p>
      </div>
      <ul className="grid gap-1.5 sm:grid-cols-2">
        <li className="flex items-center gap-2 text-sm">{allStepsDone ? <CheckCircle2 className="h-4 w-4 text-success" /> : <Circle className="h-4 w-4 text-muted-foreground" />}All 12 setup steps</li>
        {items.map((i) => (
          <li key={i.key} className="flex items-center gap-2 text-sm">
            {i.done ? <CheckCircle2 className="h-4 w-4 text-success" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
            {i.label}
          </li>
        ))}
      </ul>
      {!submitted && (
        <Button onClick={() => void submit()} disabled={!ready || busy} className="gap-2">
          <Send className="h-4 w-4" /> {busy ? "Submitting…" : "Submit for review"}
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Application submitted</DialogTitle>
            <DialogDescription>
              Your application has been submitted for review. You will get an email confirmation upon approval. For queries contact support at{" "}
              <a className="text-primary underline" href="mailto:support@barakaz.com">support@barakaz.com</a>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter><Button onClick={() => setOpen(false)}>OK</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
