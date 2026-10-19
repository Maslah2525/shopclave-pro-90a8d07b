import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Disposable local PostgreSQL only: never writes production records or impersonates users.
const db = new PGlite();
const migration = readFileSync("drizzle/migrations/0036_extend_dynamic_banner_system.sql", "utf8");
const admin = "00000000-0000-0000-0000-000000000001";
const marketing = "00000000-0000-0000-0000-000000000002";
const customer = "00000000-0000-0000-0000-000000000003";
const scopedAdmin = "00000000-0000-0000-0000-000000000004";

beforeAll(async () => {
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
      $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    GRANT USAGE ON SCHEMA auth TO anon, authenticated;
    CREATE TYPE public.app_role AS ENUM ('admin', 'vendor', 'customer');
    CREATE TABLE public.user_roles(user_id uuid, role public.app_role);
    CREATE TABLE public.team_roles(id uuid, permissions text[]);
    CREATE TABLE public.team_members(user_id uuid, team_role_id uuid);
    CREATE FUNCTION public.has_permission(_user_id uuid, _perm text) RETURNS boolean
      LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO public AS $$
      DECLARE _is_admin boolean; _has_membership boolean; _granted boolean;
      BEGIN
        IF _user_id IS NULL THEN RETURN false; END IF;
        SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role='admin'::app_role) INTO _is_admin;
        IF NOT _is_admin THEN RETURN false; END IF;
        SELECT EXISTS(SELECT 1 FROM public.team_members WHERE user_id=_user_id) INTO _has_membership;
        IF NOT _has_membership THEN RETURN true; END IF;
        SELECT EXISTS(SELECT 1 FROM public.team_members tm JOIN public.team_roles tr ON tr.id=tm.team_role_id
          WHERE tm.user_id=_user_id AND (_perm=ANY(tr.permissions) OR '*'=ANY(tr.permissions))) INTO _granted;
        RETURN _granted;
      END; $$;
    CREATE TABLE public.vendors(id uuid PRIMARY KEY);
    CREATE TABLE public.hero_banners(
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text, subtitle text, cta_label text,
      link_url text NOT NULL DEFAULT '/', desktop_image_url text NOT NULL, mobile_image_url text,
      display_order integer NOT NULL DEFAULT 0, is_active boolean NOT NULL DEFAULT true,
      starts_at timestamptz, ends_at timestamptz, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
    CREATE TABLE public.promotions(
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), kind text NOT NULL CHECK(kind IN ('brand','product')),
      placement text NOT NULL CONSTRAINT promotions_placement_check CHECK(placement IN ('featured_brands','sponsored_products')),
      title text NOT NULL, subtitle text, image_url text NOT NULL, link_url text NOT NULL DEFAULT '/',
      display_order integer NOT NULL DEFAULT 0, is_active boolean NOT NULL DEFAULT true,
      starts_at timestamptz, ends_at timestamptz, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
    INSERT INTO public.user_roles VALUES ('${admin}','admin'),('${marketing}','admin'),('${customer}','customer'),('${scopedAdmin}','admin');
    INSERT INTO public.team_roles VALUES ('${marketing}',ARRAY['marketing.manage']),('${scopedAdmin}',ARRAY['orders.view']);
    INSERT INTO public.team_members VALUES ('${marketing}','${marketing}'),('${scopedAdmin}','${scopedAdmin}');
    INSERT INTO public.promotions(kind,placement,title,image_url)
      SELECT 'brand','featured_brands','Original '||n,'https://example.com/'||n||'.webp' FROM generate_series(1,15) n;
  `);
  for (const table of ["hero_banners", "promotions"]) {
    await db.exec(`
      ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;
      GRANT ALL ON public.${table} TO anon, authenticated, service_role;
      CREATE POLICY live ON public.${table} FOR SELECT TO anon,authenticated USING
        (is_active AND (starts_at IS NULL OR starts_at<=now()) AND (ends_at IS NULL OR ends_at>now()));
      CREATE POLICY staff_read ON public.${table} FOR SELECT TO authenticated USING(public.has_permission(auth.uid(),'marketing.manage'));
      CREATE POLICY staff_insert ON public.${table} FOR INSERT TO authenticated WITH CHECK(public.has_permission(auth.uid(),'marketing.manage'));
      CREATE POLICY staff_update ON public.${table} FOR UPDATE TO authenticated USING(public.has_permission(auth.uid(),'marketing.manage')) WITH CHECK(public.has_permission(auth.uid(),'marketing.manage'));
      CREATE POLICY staff_delete ON public.${table} FOR DELETE TO authenticated USING(public.has_permission(auth.uid(),'marketing.manage'));
    `);
  }
  await db.exec(migration);
}, 60000);
afterAll(async () => { await db.close(); });

async function isolated(action: () => Promise<void>) {
  await db.exec("BEGIN");
  try { await action(); } finally { await db.exec("ROLLBACK"); }
}
async function asRole(role: string, user = "") {
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)", [user]);
  await db.exec(`SET LOCAL ROLE ${role}`);
}
async function insert(table: string, extra = "", values: unknown[] = []) {
  const base = table === "hero_banners"
    ? "INSERT INTO public.hero_banners(desktop_image_url" + extra + ") VALUES ('https://example.com/banner.webp'"
    : "INSERT INTO public.promotions(kind,placement,title,image_url" + extra + ") VALUES ('brand','featured_brands','Local banner','https://example.com/banner.webp'";
  return db.query(`${base}${values.map((_, i) => `,$${i + 1}`).join("")}) RETURNING *`, values);
}

describe("dynamic banner database rules (isolated PostgreSQL)", () => {
  it("preserves all 15 legacy promotional records", async () => {
    const result = await db.query("SELECT count(*)::int AS n FROM public.promotions WHERE title LIKE 'Original %' AND image_url LIKE 'https://example.com/%.webp'");
    expect(result.rows).toEqual([{ n: 15 }]);
  });
  for (const table of ["hero_banners", "promotions"]) {
    it(`${table}: defaults to image/fade/700ms/5000ms/all and empty config`, async () => isolated(async () => {
      const { rows } = await insert(table);
      expect(rows[0]).toMatchObject({ banner_mode: "image", animation_type: "fade", transition_duration_ms: 700, rotation_interval_ms: 5000, target_device: "all", animation_config: {}, vendor_id: null });
    }));
    it(`${table}: accepts only image/dynamic modes`, async () => {
      for (const mode of ["image", "dynamic"]) await isolated(async () => { await insert(table, ",banner_mode", [mode]); });
      await isolated(async () => { await expect(insert(table, ",banner_mode", ["video"])).rejects.toThrow(); });
    });
    it(`${table}: accepts the five specified animations`, async () => {
      for (const animation of ["none", "fade", "slide", "zoom", "float"]) await isolated(async () => { await insert(table, ",animation_type", [animation]); });
      await isolated(async () => { await expect(insert(table, ",animation_type", ["spin"])).rejects.toThrow(); });
    });
    it(`${table}: rejects invalid durations`, async () => {
      for (const durations of [[-1,5000],[10001,20000],[700,999],[700,300001],[2000,1000]]) {
        await isolated(async () => { await expect(insert(table, ",transition_duration_ms,rotation_interval_ms", durations)).rejects.toThrow(); });
      }
    });
    it(`${table}: accepts all/desktop/mobile and rejects other devices`, async () => {
      for (const device of ["all", "desktop", "mobile"]) await isolated(async () => { await insert(table, ",target_device", [device]); });
      await isolated(async () => { await expect(insert(table, ",target_device", ["tablet"])).rejects.toThrow(); });
    });
    it(`${table}: requires a safe JSON object`, async () => {
      for (const config of ['[]','null','{"src":"javascript:alert(1)"}','{"html":"<script>bad</script>"}','{"__proto__":{}}',JSON.stringify({ text: "a".repeat(17000) })]) {
        await isolated(async () => { await expect(insert(table, ",animation_config", [config])).rejects.toThrow(); });
      }
      await isolated(async () => { await insert(table, ",animation_config", ['{"layers":[{"image_url":"https://example.com/a.webp","opacity":0.7}]}']); });
    });
    it(`${table}: rejects unsafe external URLs`, async () => {
      for (const url of ["javascript:alert(1)","http://example.com","//example.com/a","https://user:pass@example.com/a","/\\evil","/bad%0aurl"]) {
        await isolated(async () => { await expect(insert(table, ",link_url", [url])).rejects.toThrow(); });
      }
    });
    it(`${table}: verifies vendor foreign keys`, async () => isolated(async () => {
      await expect(insert(table, ",vendor_id", [customer])).rejects.toThrow(/foreign key/i);
    }));
    for (const [label, user] of [["super admin", admin], ["marketing.manage admin", marketing]]) {
      it(`${table}: ${label} can create, edit and delete`, async () => isolated(async () => {
        await asRole("authenticated", user);
        const { rows } = await insert(table);
        const id = (rows[0] as { id: string }).id;
        expect((await db.query(`UPDATE public.${table} SET title='Updated' WHERE id=$1 RETURNING title`, [id])).rows).toEqual([{ title: "Updated" }]);
        expect((await db.query(`DELETE FROM public.${table} WHERE id=$1 RETURNING id`, [id])).rows).toHaveLength(1);
      }));
    }
    for (const [label, role, user] of [["anonymous", "anon", ""], ["customer", "authenticated", customer], ["admin without marketing permission", "authenticated", scopedAdmin]]) {
      it(`${table}: ${label} cannot create, edit or delete`, async () => {
        await isolated(async () => { await asRole(role, user); await expect(insert(table)).rejects.toThrow(/permission|row-level security/i); });
        for (const command of ["UPDATE", "DELETE"]) await isolated(async () => {
          await insert(table);
          await asRole(role, user);
          const sql = command === "UPDATE" ? `UPDATE public.${table} SET title='Unauthorized' RETURNING id` : `DELETE FROM public.${table} RETURNING id`;
          if (role === "anon") await expect(db.query(sql)).rejects.toThrow(/permission/i);
          else expect((await db.query(sql)).rows).toEqual([]);
        });
      });
    }
    it(`${table}: public sees only active banners inside the display window`, async () => isolated(async () => {
      await insert(table, ",title,is_active,starts_at,ends_at".replace(table === "promotions" ? ",title" : "", ""), table === "promotions" ? [true,null,null] : ["Eligible",true,null,null]);
      await insert(table, ",is_active", [false]);
      await insert(table, ",starts_at", ["2999-01-01"]);
      await insert(table, ",ends_at", ["2000-01-01"]);
      const before = await db.query(`SELECT count(*)::int AS n FROM public.${table} WHERE is_active AND (starts_at IS NULL OR starts_at<=now()) AND (ends_at IS NULL OR ends_at>now())`);
      await asRole("anon");
      expect((await db.query(`SELECT count(*)::int AS n FROM public.${table}`)).rows).toEqual(before.rows);
    }));
  }
  it("retains both old placements and accepts all six new placements", async () => {
    for (const placement of ["featured_brands","sponsored_products","featured_products_banner","sponsored_products_banner","category_promotion","flash_sale_banner","homepage_full_width","homepage_secondary"]) {
      await isolated(async () => { await db.query("INSERT INTO public.promotions(kind,placement,title,image_url) VALUES ('product',$1,'Local','https://example.com/a.webp')", [placement]); });
    }
    await isolated(async () => { await expect(db.query("INSERT INTO public.promotions(kind,placement,title,image_url) VALUES ('product','unsupported','Local','https://example.com/a.webp')")).rejects.toThrow(); });
  });
});