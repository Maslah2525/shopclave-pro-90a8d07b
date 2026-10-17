CREATE TABLE public.vendor_settings_preferences (
 vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
 section text NOT NULL CHECK (section IN ('profile','branding','shipping','business','tax','returns','policies','notifications','payouts','security')),
 settings jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(settings) = 'object'),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (vendor_id, section)
);
GRANT SELECT, INSERT, UPDATE ON public.vendor_settings_preferences TO authenticated;
GRANT ALL ON public.vendor_settings_preferences TO service_role;
ALTER TABLE public.vendor_settings_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Store owners read their preferences" ON public.vendor_settings_preferences FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = vendor_id AND v.user_id = auth.uid()));
CREATE POLICY "Store owners insert their preferences" ON public.vendor_settings_preferences FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = vendor_id AND v.user_id = auth.uid()));
CREATE POLICY "Store owners update their preferences" ON public.vendor_settings_preferences FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = vendor_id AND v.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = vendor_id AND v.user_id = auth.uid()));
COMMENT ON TABLE public.vendor_settings_preferences IS 'Owner-only store preferences and unverified drafts. Never grants staff access or overrides tax, payment, shipping quote, approval, verification, refund, or notification delivery logic.';