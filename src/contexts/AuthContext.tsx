import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";
import { hasPerm } from "@/lib/permissions";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  userRoles: string[];
  permissions: string[];
  hasPermission: (perm: string) => boolean;
  isSuperAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  const fetchRolesAndPerms = async (userId: string) => {
    const { data: roleRows } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const roles = roleRows?.map((r: any) => r.role) || [];
    setUserRoles(roles);

    if (!roles.includes("admin")) {
      setPermissions([]);
      setIsSuperAdmin(false);
      return;
    }

    // Resolve team membership → permissions
    const { data: membership } = await supabase
      .from("team_members")
      .select("team_role_id, team_roles ( permissions )")
      .eq("user_id", userId)
      .maybeSingle();

    if (!membership) {
      // Admin without a team_role assignment ⇒ super admin (back-compat)
      setPermissions(["*"]);
      setIsSuperAdmin(true);
    } else {
      const perms = ((membership as any).team_roles?.permissions as string[]) || [];
      setPermissions(perms);
      setIsSuperAdmin(perms.includes("*"));
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        // Keep loading until roles resolve so route guards never see a user with no roles.
        setTimeout(() => fetchRolesAndPerms(session.user.id).finally(() => setLoading(false)), 0);
      } else {
        setUserRoles([]);
        setPermissions([]);
        setIsSuperAdmin(false);
        setLoading(false);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) fetchRolesAndPerms(session.user.id).finally(() => setLoading(false));
      else setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, fullName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const hasPermission = (perm: string) => hasPerm(permissions, perm);

  return (
    <AuthContext.Provider
      value={{ user, session, loading, signUp, signIn, signOut, userRoles, permissions, hasPermission, isSuperAdmin }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
