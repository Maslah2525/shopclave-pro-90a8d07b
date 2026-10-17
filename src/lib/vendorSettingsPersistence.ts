export type SettingsRecord = Record<string, unknown>;

export function settingsRecord(value: unknown): SettingsRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as SettingsRecord : {};
}

// Only keys represented by the form are hydrated; unknown stored keys are preserved on save.
export function restoreSettings<T extends object>(defaults: T, stored: unknown): T {
  const record = settingsRecord(stored);
  const restored = { ...defaults };
  for (const key of Object.keys(defaults) as (keyof T)[]) {
    const value = record[String(key)];
    const fallback = defaults[key];
    if (Array.isArray(fallback)) {
      if (Array.isArray(value)) restored[key] = value as T[keyof T];
    } else if (fallback !== null && typeof fallback === "object") {
      restored[key] = (Object.keys(fallback).length === 0 ? { ...settingsRecord(value) } : restoreSettings(fallback, value)) as T[keyof T];
    } else if (typeof value === typeof fallback || (fallback === null && (typeof value === "string" || value === null))) {
      restored[key] = value as T[keyof T];
    }
  }
  return restored;
}

export function mergeSettings(previous: unknown, next: SettingsRecord): SettingsRecord {
  const merged = { ...settingsRecord(previous) };
  for (const [key, value] of Object.entries(next)) {
    merged[key] = value && typeof value === "object" && !Array.isArray(value)
      ? mergeSettings(merged[key], settingsRecord(value)) : value;
  }
  return merged;
}

export function publicStoreSettings(previous: unknown, profile: SettingsRecord, branding: SettingsRecord) {
  // No contact details, tax identifiers, documents, security preferences or bank data.
  return mergeSettings(previous, {
    profile: {
      primary_category_id: profile.primary_category_id,
      additional_category_ids: profile.additional_category_ids,
      public_store_address: profile.public_store_address,
      store_language: profile.store_language,
    },
    branding: {
      color: branding.color, style: branding.style, featured: branding.featured,
      welcome: branding.welcome, instagram: branding.instagram, facebook: branding.facebook,
      tiktok: branding.tiktok, youtube: branding.youtube,
    },
  });
}

export function sameSettings(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((value, i) => sameSettings(value, b[i]));
  if (a && b && typeof a === "object" && typeof b === "object") {
    const left = settingsRecord(a), right = settingsRecord(b);
    const keys = Object.keys(left);
    return keys.length === Object.keys(right).length && keys.every(key => sameSettings(left[key], right[key]));
  }
  return false;
}