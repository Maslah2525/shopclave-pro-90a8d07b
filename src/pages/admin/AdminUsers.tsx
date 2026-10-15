import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Search, Users } from "lucide-react";
import { useState } from "react";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminEmptyState from "@/components/admin/AdminEmptyState";

const roleStyles: Record<string, string> = {
  admin: "bg-[hsl(var(--admin-accent-info))]/10 text-[hsl(var(--admin-accent-info))]",
  vendor: "bg-primary/10 text-primary",
  customer: "bg-muted text-muted-foreground",
};

const AdminUsers = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  const { data: profiles } = useQuery({
    queryKey: ["admin-profiles"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  const { data: roles } = useQuery({
    queryKey: ["admin-all-roles"],
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("*");
      return data || [];
    },
    enabled: !!user,
  });

  const addRole = useMutation({
    mutationFn: async ({ user_id, role }: { user_id: string; role: string }) => {
      throw new Error("Direct role grants are disabled. Use the verified seller onboarding process or a separately audited privileged administrator workflow.");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-all-roles"] });
      toast.success("Role added");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const getUserRoles = (userId: string) =>
    roles?.filter((r: any) => r.user_id === userId).map((r: any) => r.role) || [];

  const filtered = (profiles || []).filter((p: any) =>
    !search || (p.full_name || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <AdminPageHeader title="User Management" subtitle="Review marketplace participants. Privileged role assignments require verified onboarding and authorization." count={profiles?.length || 0} countLabel="users">
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name..." className="pl-9 h-9 bg-card" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </AdminPageHeader>

      <div className="admin-card overflow-hidden">
        {filtered.length === 0 ? (
          <AdminEmptyState
            icon={Users}
            title={search ? "No users match your search" : "No users yet"}
            description={search ? "Try a different name." : "Registered users will appear here."}
          />
        ) : (
          <div className="overflow-x-auto max-h-[calc(100vh-220px)]">
            <table className="admin-table min-w-[600px]">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Roles</th>
                  <th>Joined</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p: any) => {
                  const userRoles = getUserRoles(p.user_id);
                  return (
                    <tr key={p.id}>
                      <td>
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-xs font-semibold">
                            {(p.full_name || "?")[0].toUpperCase()}
                          </div>
                          <span className="font-medium text-foreground">{p.full_name || "—"}</span>
                        </div>
                      </td>
                      <td>
                        <div className="flex gap-1 flex-wrap">
                          {userRoles.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
                          {userRoles.map((r: string) => (
                            <span key={r} className={`status-pill capitalize ${roleStyles[r] || "bg-muted text-muted-foreground"}`}>{r}</span>
                          ))}
                        </div>
                      </td>
                      <td className="text-muted-foreground text-xs">{new Date(p.created_at).toLocaleDateString()}</td>
                      <td>
                        <div className="flex gap-1 justify-end">
                          {false && !userRoles.includes("vendor") && (
                            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => addRole.mutate({ user_id: p.user_id, role: "vendor" })}>
                              + Vendor
                            </Button>
                          )}
                          {false && !userRoles.includes("admin") && (
                            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => addRole.mutate({ user_id: p.user_id, role: "admin" })}>
                              + Admin
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminUsers;
