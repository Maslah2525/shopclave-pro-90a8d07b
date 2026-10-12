# Production Edge Function deployments

The workflow `.github/workflows/deploy-supabase-edge.yml` deploys **one** approved Edge Function per manually initiated run. It does not deploy database migrations, update secrets, or change the frontend.

## One-time configuration

In GitHub repository **Settings → Environments**, create `production`. Configure required reviewers if available.

Under the `production` environment, configure:
- Secret `SUPABASE_ACCESS_TOKEN`: Supabase personal access token with permission to deploy to the correct production project. Never commit the token.
- Variable `SUPABASE_PROJECT_REF`: verified project ref for the production Supabase project. Compare it against the Supabase dashboard URL before entering it.

The current `supabase/config.toml` contains project_id `fyfeyolecqnpriwjgzyo`; this is **not proof** of the intended live project. Independently verify the target before running.

## Deploy

1. Open **Actions → Deploy Supabase Edge Function (manual) → Run workflow** on the main branch.
2. Choose `stripe-initialize`.
3. Enter the exact project ref configured in the production environment variable.
4. Review and approve the protected environment job, if configured.
5. Inspect the logs for a successful deploy. Verify function version and logs in Supabase.
6. Perform a non-charge checkout smoke test, followed by an explicitly authorized payment test.

Do not deploy `create-order` or other functions without reviewing schema compatibility and a rollback plan. Stripe idempotency changes are not a substitute for a unique order creation key or database-level transaction integrity.
