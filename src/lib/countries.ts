// ISO 3166-1 alpha-2 countries with E.164 dial codes. Names come from Intl.DisplayNames.
// Barakaz ships Canada -> Canada only today; everything else is "quote required".

const RAW =
  "AF93 AX358 AL355 DZ213 AS1 AD376 AO244 AI1 AG1 AR54 AM374 AW297 AU61 AT43 AZ994 BS1 BH973 BD880 BB1 BY375 BE32 BZ501 BJ229 BM1 BT975 BO591 BA387 BW267 BR55 IO246 VG1 BN673 BG359 BF226 BI257 KH855 CM237 CA1 CV238 BQ599 KY1 CF236 TD235 CL56 CN86 CX61 CC61 CO57 KM269 CG242 CD243 CK682 CR506 CI225 HR385 CU53 CW599 CY357 CZ420 DK45 DJ253 DM1 DO1 EC593 EG20 SV503 GQ240 ER291 EE372 SZ268 ET251 FK500 FO298 FJ679 FI358 FR33 GF594 PF689 GA241 GM220 GE995 DE49 GH233 GI350 GR30 GL299 GD1 GP590 GU1 GT502 GG44 GN224 GW245 GY592 HT509 HN504 HK852 HU36 IS354 IN91 ID62 IR98 IQ964 IE353 IM44 IL972 IT39 JM1 JP81 JE44 JO962 KZ7 KE254 KI686 XK383 KW965 KG996 LA856 LV371 LB961 LS266 LR231 LY218 LI423 LT370 LU352 MO853 MG261 MW265 MY60 MV960 ML223 MT356 MH692 MQ596 MR222 MU230 YT262 MX52 FM691 MD373 MC377 MN976 ME382 MS1 MA212 MZ258 MM95 NA264 NR674 NP977 NL31 NC687 NZ64 NI505 NE227 NG234 NU683 NF672 KP850 MK389 MP1 NO47 OM968 PK92 PW680 PS970 PA507 PG675 PY595 PE51 PH63 PN64 PL48 PT351 PR1 QA974 RE262 RO40 RU7 RW250 WS685 SM378 ST239 SA966 SN221 RS381 SC248 SL232 SG65 SX1 SK421 SI386 SB677 SO252 ZA27 KR82 SS211 ES34 LK94 BL590 SH290 KN1 LC1 MF590 PM508 VC1 SD249 SR597 SJ47 SE46 CH41 SY963 TW886 TJ992 TZ255 TH66 TL670 TG228 TK690 TO676 TT1 TN216 TR90 TM993 TC1 TV688 VI1 UG256 UA380 AE971 GB44 US1 UY598 UZ998 VU678 VA39 VE58 VN84 WF681 EH212 YE967 ZM260 ZW263";

export interface Country { code: string; name: string; dial: string }

const names = typeof Intl !== "undefined" && (Intl as any).DisplayNames
  ? new (Intl as any).DisplayNames(["en"], { type: "region" })
  : null;

export const COUNTRIES: Country[] = RAW.split(" ")
  .map((t) => {
    const code = t.slice(0, 2);
    return { code, dial: "+" + t.slice(2), name: (names?.of(code) as string) || code };
  })
  .sort((a, b) => a.name.localeCompare(b.name));

export const DEFAULT_COUNTRY = "CA";
const ALIASES: Record<string, string> = { uk: "GB", "great britain": "GB", england: "GB", usa: "US", america: "US", "united states of america": "US" };

export const countryByCode = (code: string) => COUNTRIES.find((c) => c.code === code.toUpperCase());
export function countryByName(name: string): Country | undefined {
  const s = (name || "").trim().toLowerCase();
  if (!s) return undefined;
  return COUNTRIES.find((c) => c.name.toLowerCase() === s) ?? (ALIASES[s] ? countryByCode(ALIASES[s]) : undefined) ?? (s.length === 2 ? countryByCode(s) : undefined);
}

/** Search by name, ISO code, alias or dial code. Shared +1 countries stay distinct by name/code. */
export function searchCountries(query: string): Country[] {
  const q = query.trim().toLowerCase();
  if (!q) return COUNTRIES;
  const alias = ALIASES[q];
  return COUNTRIES.filter((c) =>
    c.name.toLowerCase().includes(q) || c.code.toLowerCase() === q || c.code === alias || c.dial === (q.startsWith("+") ? q : "+" + q),
  );
}

export interface AddressFormat { regionLabel: string; postalLabel: string; postalRequired: boolean; postalPattern?: RegExp; postalExample?: string }

const FORMATS: Record<string, AddressFormat> = {
  CN: { regionLabel: "Province / Municipality", postalLabel: "Postal Code", postalRequired: false, postalPattern: /^\\d{6}$/, postalExample: "100000" },
  KR: { regionLabel: "Province / Metropolitan City", postalLabel: "Postal Code", postalRequired: true, postalPattern: /^\\d{5}$/, postalExample: "04524" },
  CA: { regionLabel: "Province / Territory", postalLabel: "Postal Code", postalRequired: true, postalPattern: /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/, postalExample: "K1A 0B1" },
  US: { regionLabel: "State", postalLabel: "ZIP Code", postalRequired: true, postalPattern: /^\d{5}(-\d{4})?$/, postalExample: "10001" },
  GB: { regionLabel: "County (optional)", postalLabel: "Postcode", postalRequired: true, postalPattern: /^[A-Za-z]{1,2}\d[A-Za-z\d]?\s?\d[A-Za-z]{2}$/, postalExample: "SW1A 1AA" },
  AU: { regionLabel: "State / Territory", postalLabel: "Postcode", postalRequired: true, postalPattern: /^\d{4}$/, postalExample: "2000" },
  IN: { regionLabel: "State", postalLabel: "PIN Code", postalRequired: true, postalPattern: /^\d{6}$/, postalExample: "110001" },
  KE: { regionLabel: "County", postalLabel: "Postal Code (optional)", postalRequired: false, postalPattern: /^\d{5}$/, postalExample: "00100" },
};

export const addressFormat = (code: string): AddressFormat =>
  FORMATS[code.toUpperCase()] ?? { regionLabel: "State / Region", postalLabel: "Postal Code", postalRequired: false };

/** Returns an error message, or null if valid. */
export function validatePostal(code: string, postal: string): string | null {
  const f = addressFormat(code);
  const v = postal.trim();
  if (!v) return f.postalRequired ? `${f.postalLabel} is required` : null;
  if (f.postalPattern && !f.postalPattern.test(v)) return `Enter a valid ${f.postalLabel.replace(" (optional)", "")}${f.postalExample ? `, e.g. ${f.postalExample}` : ""}`;
  return null;
}

/** Only Canadian destinations have server-side shipping quotes and tax today. */
export const isDomesticDestination = (code: string) => code.toUpperCase() === "CA";
