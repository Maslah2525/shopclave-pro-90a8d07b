import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Send, Bell } from "lucide-react";

const AdminNotifications = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ title: "", message: "", type: "info", recipientMode: "all", vendorId: "" });

  const { data: vendors, isLoading: vendorsLoading, error: vendorsError } = useQuery({
    queryKey: ["admin-vendors"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vendors").select("id, store_name, user_id").eq("status", "approved");
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const { data: sentNotifications, isLoading: historyLoading, error: historyError } = useQuery({
    queryKey: ["admin-sent-notifications"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("notifications").select("*").order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const sendNotification = useMutation({
    mutationFn: async () => {
      if (!form.title.trim() || !form.message.trim()) throw new Error("Title and message required");
      if (vendorsLoading || vendorsError || !vendors) throw new Error("Vendor recipients are not available. Please retry after they load.");

      const recipients = form.recipientMode === "all"
        ? vendors?.map((v: any) => v.user_id) || []
        : [vendors?.find((v: any) => v.id === form.vendorId)?.user_id].filter(Boolean);

      if (recipients.length === 0) throw new Error("No recipients selected");

      const rows = recipients.map((rid: string) => ({
        recipient_id: rid,
        sender_id: user!.id,
        title: form.title.trim(),
        message: form.message.trim(),
        type: form.type,
      }));

      const { error } = await (supabase as any).from("notifications").insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-sent-notifications"] });
      setForm({ title: "", message: "", type: "info", recipientMode: "all", vendorId: "" });
      toast.success("Notification sent!");
    },
    onError: (err: any) => toast.error(err.message),
  });

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Send Notifications</h2>
      {vendorsError && <p role="alert" className="text-destructive">Unable to load vendor recipients. Sending is unavailable until this is resolved.</p>}

      <div className="bg-card rounded-lg border border-border p-6 max-w-lg space-y-4">
        <div>
          <Label>Title</Label>
          <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Notification title" />
        </div>
        <div>
          <Label>Message</Label>
          <Textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} rows={3} placeholder="Write your message..." />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Type</Label>
            <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="alert">Alert</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Recipients</Label>
            <Select value={form.recipientMode} onValueChange={(v) => setForm({ ...form, recipientMode: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Vendors</SelectItem>
                <SelectItem value="specific">Specific Vendor</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {form.recipientMode === "specific" && (
          <div>
            <Label>Select Vendor</Label>
            <Select value={form.vendorId} onValueChange={(v) => setForm({ ...form, vendorId: v })}>
              <SelectTrigger><SelectValue placeholder="Choose vendor" /></SelectTrigger>
              <SelectContent>
                {vendors?.map((v: any) => (
                  <SelectItem key={v.id} value={v.id}>{v.store_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <Button className="w-full gap-2" onClick={() => sendNotification.mutate()} disabled={sendNotification.isPending || vendorsLoading || !!vendorsError}>
          <Send className="h-4 w-4" /> {sendNotification.isPending ? "Sending..." : "Send Notification"}
        </Button>
      </div>

      {/* History */}
      <div>
        <h3 className="font-semibold mb-3">Sent History</h3>
        {historyLoading && <p className="text-sm text-muted-foreground">Loading notification history…</p>}
        {historyError && <p role="alert" className="text-destructive">Unable to load notification history.</p>}
        <div className="space-y-2">
          {sentNotifications?.map((n: any) => (
            <div key={n.id} className="bg-card rounded-lg border border-border p-3 flex items-start gap-3">
              <Bell className={`h-4 w-4 mt-0.5 shrink-0 ${n.type === "alert" ? "text-destructive" : n.type === "warning" ? "text-warning" : n.type === "success" ? "text-success" : "text-primary"}`} />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{n.title}</p>
                <p className="text-xs text-muted-foreground line-clamp-1">{n.message}</p>
              </div>
              <span className="text-xs text-muted-foreground shrink-0">{new Date(n.created_at).toLocaleDateString()}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminNotifications;
