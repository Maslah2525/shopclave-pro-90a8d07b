import { countryByName, validatePostal } from "@/lib/countries";

export type CustomerDetails = { fullName: string; phone: string; addressLine: string; city: string; country: string; state: string; zip: string };

export function customerDetailsError(details: CustomerDetails): string | null {
  if (![details.fullName, details.phone, details.addressLine, details.city].every(value => value.trim())) return "Enter your name, telephone, address and city";
  const country = countryByName(details.country);
  if (!country) return "Select a country";
  if (country.code === "CA" && !details.state.trim()) return "Select your province or territory";
  return validatePostal(country.code, details.zip);
}

export function detailsFromSaved(address: { full_name: string; phone: string | null; address_line: string; city: string; country: string; state: string | null; postal_code: string | null }): CustomerDetails {
  return { fullName: address.full_name, phone: address.phone ?? "", addressLine: address.address_line, city: address.city, country: address.country, state: address.state ?? "", zip: address.postal_code ?? "" };
}

export function customerDetailsParams(details: CustomerDetails) {
  return { p_full_name: details.fullName.trim(), p_phone: details.phone.trim(), p_address_line: details.addressLine.trim(), p_city: details.city.trim(), p_state: details.state.trim(), p_country: countryByName(details.country)?.name ?? details.country.trim(), p_postal_code: details.zip.trim() };
}