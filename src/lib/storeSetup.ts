export interface SetupItem { key: string; label: string; done: boolean }

const filled = (v: unknown, min = 1) => typeof v === "string" && v.trim().length >= min;

/** Mirrors the server-side checks in submit_vendor_for_review. */
export function storeSetupChecklist(vendor: any): SetupItem[] {
  const name = vendor?.store_name ?? "";
  return [
    { key: "name", label: "Store name", done: filled(name, 2) && !/^pending store setup/i.test(name) },
    { key: "description", label: "Store description", done: filled(vendor?.store_description, 10) },
    { key: "phone", label: "Store phone number", done: filled(vendor?.phone, 7) },
    { key: "logo", label: "Store logo", done: filled(vendor?.logo_url) },
  ];
}
