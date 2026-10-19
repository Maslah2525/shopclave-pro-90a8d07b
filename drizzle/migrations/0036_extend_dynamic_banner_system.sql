ALTER TABLE public.hero_banners
  ADD COLUMN IF NOT EXISTS banner_mode text DEFAULT 'image',
  ADD COLUMN IF NOT EXISTS animation_type text DEFAULT 'fade',
  ADD COLUMN IF NOT EXISTS transition_duration_ms integer DEFAULT 700,
  ADD COLUMN IF NOT EXISTS rotation_interval_ms integer DEFAULT 5000,
  ADD COLUMN IF NOT EXISTS background_color text,
  ADD COLUMN IF NOT EXISTS background_gradient text,
  ADD COLUMN IF NOT EXISTS animation_config jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS vendor_id uuid,
  ADD COLUMN IF NOT EXISTS target_device text DEFAULT 'all';

ALTER TABLE public.promotions
  ADD COLUMN IF NOT EXISTS desktop_image_url text,
  ADD COLUMN IF NOT EXISTS mobile_image_url text,
  ADD COLUMN IF NOT EXISTS banner_mode text DEFAULT 'image',
  ADD COLUMN IF NOT EXISTS animation_type text DEFAULT 'fade',
  ADD COLUMN IF NOT EXISTS animation_config jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS transition_duration_ms integer DEFAULT 700,
  ADD COLUMN IF NOT EXISTS rotation_interval_ms integer DEFAULT 5000,
  ADD COLUMN IF NOT EXISTS background_color text,
  ADD COLUMN IF NOT EXISTS background_gradient text,
  ADD COLUMN IF NOT EXISTS cta_label text,
  ADD COLUMN IF NOT EXISTS vendor_id uuid,
  ADD COLUMN IF NOT EXISTS target_device text DEFAULT 'all';

-- Only the placement constraint is replaced; original columns and records are untouched.
ALTER TABLE public.promotions DROP CONSTRAINT IF EXISTS promotions_placement_check;
ALTER TABLE public.promotions ADD CONSTRAINT promotions_placement_check CHECK (
  placement IN ('featured_brands', 'sponsored_products', 'featured_products_banner',
    'sponsored_products_banner', 'category_promotion', 'flash_sale_banner',
    'homepage_full_width', 'homepage_secondary')
);

-- The inspected vendor primary key is public.vendors(id), UUID.
ALTER TABLE public.hero_banners ADD CONSTRAINT hero_banners_vendor_id_fkey
  FOREIGN KEY (vendor_id) REFERENCES public.vendors(id) ON DELETE SET NULL;
ALTER TABLE public.promotions ADD CONSTRAINT promotions_vendor_id_fkey
  FOREIGN KEY (vendor_id) REFERENCES public.vendors(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.banner_url_is_safe(value text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT value IS NULL OR (
    length(value) BETWEEN 1 AND 2048
    AND value !~ '[[:space:][:cntrl:]<>"\\]'
    AND value !~* '%(00|0a|0d|5c)'
    AND (
      (value ~ '^/' AND value !~ '^//')
      OR value ~* '^https://([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)*[a-z0-9]([a-z0-9-]*[a-z0-9])?(:[0-9]{1,5})?([/?#][^[:space:]<>"\\]*)?$'
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.banner_json_is_safe(value jsonb, depth integer DEFAULT 0)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE entry record; element jsonb; text_value text;
BEGIN
  IF value IS NULL OR depth > 8 OR octet_length(value::text) > 16384 THEN RETURN false; END IF;
  CASE jsonb_typeof(value)
    WHEN 'object' THEN
      FOR entry IN SELECT key, val FROM jsonb_each(value) AS items(key, val) LOOP
        IF entry.key ~ '[[:cntrl:]<>]' OR lower(entry.key) IN ('__proto__', 'prototype', 'constructor') THEN RETURN false; END IF;
        IF entry.key ~* '(url|src|href)$' AND jsonb_typeof(entry.val) <> 'null' THEN
          IF jsonb_typeof(entry.val) <> 'string' OR NOT public.banner_url_is_safe(entry.val #>> '{}') THEN RETURN false; END IF;
        END IF;
        IF NOT public.banner_json_is_safe(entry.val, depth + 1) THEN RETURN false; END IF;
      END LOOP;
    WHEN 'array' THEN
      FOR element IN SELECT jsonb_array_elements(value) LOOP
        IF NOT public.banner_json_is_safe(element, depth + 1) THEN RETURN false; END IF;
      END LOOP;
    WHEN 'string' THEN
      text_value := value #>> '{}';
      IF text_value ~ '[[:cntrl:]<>]' OR text_value ~* '(javascript[[:space:]]*:|vbscript[[:space:]]*:|data[[:space:]]*:|url[[:space:]]*\(|expression[[:space:]]*\()' THEN RETURN false; END IF;
    ELSE NULL;
  END CASE;
  RETURN true;
END;
$$;

ALTER TABLE public.hero_banners
  ADD CONSTRAINT hero_banners_mode_check CHECK (banner_mode IS NOT NULL AND banner_mode IN ('image', 'dynamic')),
  ADD CONSTRAINT hero_banners_animation_check CHECK (animation_type IS NOT NULL AND animation_type IN ('none', 'fade', 'slide', 'zoom', 'float')),
  ADD CONSTRAINT hero_banners_durations_check CHECK (transition_duration_ms IS NOT NULL AND transition_duration_ms BETWEEN 0 AND 10000 AND rotation_interval_ms IS NOT NULL AND rotation_interval_ms BETWEEN 1000 AND 300000 AND rotation_interval_ms >= transition_duration_ms),
  ADD CONSTRAINT hero_banners_device_check CHECK (target_device IS NOT NULL AND target_device IN ('all', 'desktop', 'mobile')),
  ADD CONSTRAINT hero_banners_config_check CHECK (animation_config IS NOT NULL AND jsonb_typeof(animation_config) = 'object' AND public.banner_json_is_safe(animation_config)),
  ADD CONSTRAINT hero_banners_urls_check CHECK (public.banner_url_is_safe(link_url) AND public.banner_url_is_safe(desktop_image_url) AND public.banner_url_is_safe(mobile_image_url)),
  ADD CONSTRAINT hero_banners_background_check CHECK ((background_color IS NULL OR background_color ~ '^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?([0-9a-fA-F]{2})?$') AND (background_gradient IS NULL OR (length(background_gradient) <= 2048 AND background_gradient ~* '^(linear|radial|conic)-gradient\([a-z0-9#%.,() +/\-]+\)$' AND background_gradient !~* '(url|expression|javascript|vbscript|data)[[:space:]]*[:(]')));

ALTER TABLE public.promotions
  ADD CONSTRAINT promotions_mode_check CHECK (banner_mode IS NOT NULL AND banner_mode IN ('image', 'dynamic')),
  ADD CONSTRAINT promotions_animation_check CHECK (animation_type IS NOT NULL AND animation_type IN ('none', 'fade', 'slide', 'zoom', 'float')),
  ADD CONSTRAINT promotions_durations_check CHECK (transition_duration_ms IS NOT NULL AND transition_duration_ms BETWEEN 0 AND 10000 AND rotation_interval_ms IS NOT NULL AND rotation_interval_ms BETWEEN 1000 AND 300000 AND rotation_interval_ms >= transition_duration_ms),
  ADD CONSTRAINT promotions_device_check CHECK (target_device IS NOT NULL AND target_device IN ('all', 'desktop', 'mobile')),
  ADD CONSTRAINT promotions_config_check CHECK (animation_config IS NOT NULL AND jsonb_typeof(animation_config) = 'object' AND public.banner_json_is_safe(animation_config)),
  ADD CONSTRAINT promotions_urls_check CHECK (public.banner_url_is_safe(image_url) AND public.banner_url_is_safe(link_url) AND public.banner_url_is_safe(desktop_image_url) AND public.banner_url_is_safe(mobile_image_url)),
  ADD CONSTRAINT promotions_background_check CHECK ((background_color IS NULL OR background_color ~ '^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?([0-9a-fA-F]{2})?$') AND (background_gradient IS NULL OR (length(background_gradient) <= 2048 AND background_gradient ~* '^(linear|radial|conic)-gradient\([a-z0-9#%.,() +/\-]+\)$' AND background_gradient !~* '(url|expression|javascript|vbscript|data)[[:space:]]*[:(]')));

-- Keep the inspected policies and permission functions byte-for-byte unchanged.
ALTER TABLE public.hero_banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;
-- Anonymous writes already fail RLS; remove their unnecessary table privileges too.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.hero_banners, public.promotions FROM anon;
GRANT SELECT ON public.hero_banners, public.promotions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hero_banners, public.promotions TO authenticated;
GRANT ALL ON public.hero_banners, public.promotions TO service_role;
REVOKE ALL ON FUNCTION public.banner_url_is_safe(text), public.banner_json_is_safe(jsonb, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.banner_url_is_safe(text), public.banner_json_is_safe(jsonb, integer) TO anon, authenticated, service_role;

COMMENT ON COLUMN public.hero_banners.animation_config IS 'Validated JSON object; max 16KiB and depth 8. URL/src/href keys accept HTTPS or same-origin paths. Renderer must still escape text and validate supported configuration keys.';
COMMENT ON COLUMN public.promotions.animation_config IS 'Validated JSON object; max 16KiB and depth 8. URL/src/href keys accept HTTPS or same-origin paths. Renderer must still escape text and validate supported configuration keys.';
COMMENT ON COLUMN public.hero_banners.transition_duration_ms IS '0..10000ms; rotation must be 1000..300000ms and at least the transition duration.';
COMMENT ON COLUMN public.promotions.transition_duration_ms IS '0..10000ms; rotation must be 1000..300000ms and at least the transition duration.';
COMMENT ON COLUMN public.promotions.image_url IS 'Original required image URL retained for backward compatibility; new desktop/mobile fields are optional.';