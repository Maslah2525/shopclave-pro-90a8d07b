import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, Store } from "lucide-react";

export default function VendorRegisterPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [failed, setFailed] = useState(false);
  const started = useRef(false);

  const prepare = async () => {
    if (!user) return;
    setFailed(false);
    const minDelay = new Promise((r) => setTimeout(r, 2500));
    const { data: existing, error: readErr } = await supabase.from("vendors").select("id,status").eq("user_id", user.id).maybeSingle();
    if (readErr) { setFailed(true); return; }
    if (!existing) {
      const { error } = await supabase.from("vendors").insert({
        user_id: user.id, store_name: `Pending Store Setup ${user.id.slice(0, 8)}`, status: "pending",
      });
      if (error && error.code !== "23505") { setFailed(true); return; }
    }
    await minDelay;
    navigate(existing?.status === "approved" ? "/vendor/dashboard" : "/vendor/settings?setup=1", { replace: true });
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate("/auth", { replace: true, state: { from: "/vendor/register" } }); return; }
    if (started.current) return;
    started.current = true;
    void prepare();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="text-center space-y-4 max-w-sm" role="status">
        <div className="mx-auto h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Store className="h-8 w-8 text-primary" />
        </div>
        {failed ? (
          <>
            <p className="font-semibold">We couldn't prepare your dashboard.</p>
            <Button onClick={() => void prepare()}>Try again</Button>
          </>
        ) : (
          <>
            <h1 className="text-xl font-bold">We are preparing your vendor dashboard</h1>
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
          </>
        )}
      </div>
    </main>
  );
}
