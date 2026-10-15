# User role authorization audit

Status: **read-only audit pending**. This document does not change production permissions.

## Read-only queries for the Barakaz Supabase SQL editor

Run these against the **correct Barakaz project** and inspect results before proposing any migration.

```sql
select c.relname as table_name, c.relrowsecurity as rls_enabled,
       c.relforcerowsecurity as force_rls
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in ('user_roles','vendors','seller_applications');

select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname='public' and tablename in ('user_roles','vendors','seller_applications')
order by tablename, policyname;

select grantee, table_name, privilege_type
from information_schema.role_table_grants
where table_schema='public' and table_name in ('user_roles','vendors','seller_applications')
order by table_name, grantee, privilege_type;

select n.nspname, p.proname, p.prosecdef as security_definer,
       pg_get_function_identity_arguments(p.oid) as arguments,
       pg_get_functiondef(p.oid) as definition
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in
 ('approve_seller_application','has_role','record_seller_kyc_review');
```

## Acceptance criteria

- Anonymous and ordinary authenticated accounts cannot insert, update or delete privileged roles directly.
- Non-admin users cannot set vendor status to approved via direct table mutation.
- Authorized seller approval checks administrator status, verified KYC, current reviewed country requirements and Stripe Connect.
- Existing authorized workflows continue to function; never delete production policies without comparing their exact definitions and dependencies.
- Validate denial using disposable test accounts in staging; do not grant admin privileges or create real seller approvals in production for testing.

## Repository findings

The admin UI formerly inserted user_roles directly; this was disabled in PR #53. The Vendor Management direct approval shortcut was disabled in PR #52. The SQL function in drizzle/migrations/0012_protect_existing_vendor_on_seller_approval.sql includes administrator, KYC, country rules and Stripe account checks. Repository source does **not** prove the current live database policy state.

## Deployment notes

Do not treat this document as an applied migration. Review the duplicate 0021 migration numbering before any database migration reconciliation.
