import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import MarketplaceLayout from "@/components/layout/MarketplaceLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Send, ShieldCheck, ShieldAlert, Lock } from "lucide-react";
import { toast } from "sonner";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { AttachmentButton } from "@/components/chat/AttachmentButton";
import { OpenDisputeDialog } from "@/components/chat/OpenDisputeDialog";
import { useLocale } from "@/hooks/useLocale";

const OrderChatPage = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const { user, loading } = useAuth();
  const { formatPrice } = useLocale();
  const navigate = useNavigate();
  const [order, setOrder] = useState<any>(null);
  const [vendor, setVendor] = useState<any>(null);
  const [multipleVendors, setMultipleVendors] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [activeDispute, setActiveDispute] = useState<any>(null);
  const [, setTick] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  const conversationId = orderId ? `order_${orderId}` : "";

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [user, loading, navigate]);

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, []);

  // Load order + first vendor + dispute
  useEffect(() => {
    if (!orderId || !user) return;
    (async () => {
      const { data: ord } = await supabase
        .from("orders")
        .select("*, order_items(*, products(name), vendors(id, store_name, user_id, logo_url))")
        .eq("id", orderId)
        .maybeSingle();
      if (!ord) {
        toast.error("Order not found");
        navigate("/account");
        return;
      }
      setOrder(ord);
      const orderVendors = (ord.order_items || []).map((item: any) => item.vendors).filter(Boolean);
      const distinctVendorIds = new Set(orderVendors.map((seller: any) => seller.id));
      setMultipleVendors(distinctVendorIds.size > 1);
      setVendor(distinctVendorIds.size === 1 ? orderVendors[0] : null);

      const { data: disp } = await supabase
        .from("disputes")
        .select("*")
        .eq("order_id", orderId)
        .in("status", ["open", "investigating"])
        .order("opened_at", { ascending: false })
        .maybeSingle();
      setActiveDispute(disp);
    })();
  }, [orderId, user, navigate]);

  // Load + subscribe to messages
  useEffect(() => {
    if (!conversationId || !user) return;
    (async () => {
      const { data } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });
      setMessages(data || []);
    })();

    const channel = supabase
      .channel(`order-chat-${conversationId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `conversation_id=eq.${conversationId}` },
        (p) => setMessages((prev) => [...prev, p.new]))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "chat_messages", filter: `conversation_id=eq.${conversationId}` },
        (p) => setMessages((prev) => prev.map((m) => (m.id === (p.new as any).id ? p.new : m))))
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [conversationId, user]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // Mark seen
  useEffect(() => {
    if (!user || !messages.length) return;
    const unread = messages.filter((m) => !m.seen_at && m.sender_id !== user.id);
    if (unread.length > 0) {
      supabase.rpc("mark_messages_seen", { _message_ids: unread.map((m) => m.id) }).then();
    }
  }, [messages, user]);

  const visibleMessages = useMemo(() => {
    if (!user) return [];
    return messages.filter((m) => {
      const isMine = m.sender_id === user.id;
      if (isMine && m.deleted_by_sender) return false;
      if (!isMine && m.deleted_by_receiver) return false;
      return true;
    });
  }, [messages, user]);

  const isLocked = !!activeDispute;

  const handleSend = async (overrides?: { message_type: string; attachment_url: string; attachment_type: string; attachment_size: number; body?: string }) => {
    if (!user || !vendor || !orderId || multipleVendors) return;
    if (!overrides && !newMessage.trim()) return;
    if (isLocked) return;

    setSending(true);
    try {
      const payload: any = {
        conversation_id: conversationId,
        sender_id: user.id,
        vendor_id: vendor.id,
        order_id: orderId,
        message: overrides?.body ?? newMessage.trim(),
        message_type: overrides?.message_type || "text",
      };
      if (overrides) {
        payload.attachment_url = overrides.attachment_url;
        payload.attachment_type = overrides.attachment_type;
        payload.attachment_size = overrides.attachment_size;
        if (!payload.message) payload.message = "";
      }

      const { data: inserted, error } = await supabase.from("chat_messages").insert(payload).select().single();
      if (error) throw error;

      // Mirror attachment row
      if (overrides && inserted) {
        await supabase.from("chat_attachments").insert({
          message_id: inserted.id,
          order_id: orderId,
          file_name: overrides.attachment_url.split("/").pop()?.split("?")[0] || "attachment",
          file_url: overrides.attachment_url,
          file_type: overrides.attachment_type,
          file_size: overrides.attachment_size,
          uploaded_by: user.id,
        });
      }

      // Notify the other party
      const recipientId = user.id === order?.user_id ? vendor.user_id : order?.user_id;
      if (recipientId) {
        await supabase.from("notifications").insert({
          recipient_id: recipientId,
          title: "New message about your order",
          message: (overrides?.body || newMessage.trim() || "Sent an attachment").slice(0, 100),
          type: "chat",
        });
      }

      if (!overrides) setNewMessage("");
    } catch (e: any) {
      toast.error(e.message || "Failed to send");
    } finally {
      setSending(false);
    }
  };

  const handleDeleteForMe = async (id: string) => {
    const { error } = await supabase.rpc("delete_message_for_me", { _message_id: id });
    if (error) toast.error(error.message); else toast.success("Removed from your view");
  };
  const handleDeleteForEveryone = async (id: string) => {
    const { error } = await supabase.rpc("delete_message_for_everyone", { _message_id: id });
    if (error) toast.error(error.message); else toast.success("Message deleted");
  };
  const handleEdit = async (id: string, newText: string) => {
    if (!newText) return;
    const { error } = await supabase.rpc("edit_message", { _message_id: id, _new_text: newText });
    if (error) toast.error(error.message); else toast.success("Updated");
  };

  if (loading || !user) return null;

  return (
    <MarketplaceLayout>
      <div className="container py-6 max-w-3xl">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-3 gap-1">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>

        {/* Order context header */}
        <div className="bg-card rounded-lg border border-border p-4 mb-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <p className="text-xs text-muted-foreground">Order</p>
              <p className="font-mono text-sm font-medium">#{orderId?.slice(0, 8).toUpperCase()}</p>
              {vendor && (
                <p className="text-sm mt-1">
                  Seller: <Link to={`/store/${vendor.id}`} className="text-primary hover:underline font-medium">{vendor.store_name}</Link>
                </p>
              )}
            </div>
            <div className="text-right">
              <Badge variant="secondary" className="capitalize">{order?.status || "—"}</Badge>
              <p className="text-sm font-semibold mt-1">{formatPrice(Number(order?.total || 0))}</p>
            </div>
          </div>
          {!isLocked && !multipleVendors && (
            <div className="mt-3 pt-3 border-t border-border flex justify-end">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setDisputeOpen(true)}>
                <ShieldAlert className="h-3.5 w-3.5" /> Open Dispute
              </Button>
            </div>
          )}
        </div>

        {isLocked && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 mb-3 flex items-start gap-2">
            <Lock className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
            <div className="text-xs">
              <p className="font-semibold text-destructive">Chat locked — evidence preserved for review.</p>
              <p className="text-muted-foreground mt-0.5">Reason: {activeDispute.reason}</p>
            </div>
          </div>
        )}

        <div className="text-[11px] text-muted-foreground bg-muted/30 rounded p-2 flex items-start gap-1.5 mb-3">
          <ShieldCheck className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
          <span>Chats related to orders may be securely retained for safety, dispute resolution, and fraud prevention.</span>
        </div>

        {multipleVendors && <p role="alert" className="mb-3 rounded-md border border-border bg-muted p-3 text-sm">This order includes products from multiple sellers. Sending messages is disabled here to prevent routing a message to the wrong seller. Contact support at support@barakaz.com with your order number while seller-specific conversations are being implemented.</p>}

        {/* Messages */}
        <div className="bg-card rounded-lg border border-border p-3 min-h-[400px] max-h-[60vh] overflow-y-auto space-y-2">
          {visibleMessages.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              No messages yet. Start the conversation about this order.
            </p>
          )}
          {visibleMessages.map((m) => (
            <MessageBubble
              key={m.id}
              msg={m}
              isMe={m.sender_id === user.id}
              onDeleteForMe={handleDeleteForMe}
              onDeleteForEveryone={handleDeleteForEveryone}
              onEdit={handleEdit}
              locked={isLocked}
            />
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Composer */}
        <div className="flex gap-2 mt-3 items-center">
          {!isLocked && !multipleVendors && (
            <AttachmentButton
              userId={user.id}
              disabled={sending}
              onUploaded={(info) =>
                handleSend({
                  message_type: info.messageType,
                  attachment_url: info.url,
                  attachment_type: info.type,
                  attachment_size: info.size,
                  body: "",
                })
              }
            />
          )}
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={isLocked ? "Chat locked" : "Type a message..."}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            disabled={isLocked || sending || multipleVendors}
          />
          <Button size="icon" onClick={() => handleSend()} disabled={isLocked || sending || multipleVendors || !newMessage.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>

        {orderId && (
          <OpenDisputeDialog
            orderId={orderId}
            open={disputeOpen}
            onOpenChange={setDisputeOpen}
            onOpened={async () => {
              const { data: disp } = await supabase
                .from("disputes")
                .select("*")
                .eq("order_id", orderId)
                .in("status", ["open", "investigating"])
                .order("opened_at", { ascending: false })
                .maybeSingle();
              setActiveDispute(disp);
            }}
          />
        )}
      </div>
    </MarketplaceLayout>
  );
};

export default OrderChatPage;
