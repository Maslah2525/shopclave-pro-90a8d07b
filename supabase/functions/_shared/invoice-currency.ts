// Country currencies from Unicode CLDR currencyData (current legal tender).
// https://github.com/unicode-org/cldr-json/blob/main/cldr-json/cldr-core/supplemental/currencyData.json
// Multiple-tender territories use CLDR's primary current currency.
const CURRENCY_REGIONS: Record<string, string> = {
  AED: "AE",
  AFN: "AF",
  ALL: "AL",
  AMD: "AM",
  AOA: "AO",
  ARS: "AR",
  AUD: "AU CC CX HM KI NF NR TV",
  AWG: "AW",
  AZN: "AZ",
  BAM: "BA",
  BBD: "BB",
  BDT: "BD",
  BHD: "BH",
  BIF: "BI",
  BMD: "BM",
  BND: "BN",
  BOB: "BO",
  BRL: "BR",
  BSD: "BS",
  BTN: "BT",
  BWP: "BW",
  BYN: "BY",
  BZD: "BZ",
  CAD: "CA",
  CDF: "CD",
  CHF: "CH LI",
  CLP: "CL",
  CNY: "CN",
  COP: "CO",
  CRC: "CR",
  CUP: "CU",
  CVE: "CV",
  CZK: "CZ",
  DJF: "DJ",
  DKK: "DK FO GL",
  DOP: "DO",
  DZD: "DZ",
  EGP: "EG",
  ERN: "ER",
  ETB: "ET",
  EUR: "AD AT AX BE BG BL CY DE EA EE ES EU FI FR GF GP GR HR IC IE IT LT LU LV MC ME MF MQ MT NL PM PT RE SI SK SM TF VA XK YT",
  FJD: "FJ",
  FKP: "FK",
  GBP: "GB GG GS IM JE TA",
  GEL: "GE",
  GHS: "GH",
  GIP: "GI",
  GMD: "GM",
  GNF: "GN",
  GTQ: "GT",
  GYD: "GY",
  HKD: "HK",
  HNL: "HN",
  HTG: "HT",
  HUF: "HU",
  IDR: "ID",
  ILS: "IL PS",
  INR: "IN",
  IQD: "IQ",
  IRR: "IR",
  ISK: "IS",
  JMD: "JM",
  JOD: "JO",
  JPY: "JP",
  KES: "KE",
  KGS: "KG",
  KHR: "KH",
  KMF: "KM",
  KPW: "KP",
  KRW: "KR",
  KWD: "KW",
  KYD: "KY",
  KZT: "KZ",
  LAK: "LA",
  LBP: "LB",
  LKR: "LK",
  LRD: "LR",
  LYD: "LY",
  MAD: "EH MA",
  MDL: "MD",
  MGA: "MG",
  MKD: "MK",
  MMK: "MM",
  MNT: "MN",
  MOP: "MO",
  MRU: "MR",
  MUR: "MU",
  MVR: "MV",
  MWK: "MW",
  MXN: "MX",
  MYR: "MY",
  MZN: "MZ",
  NAD: "NA",
  NGN: "NG",
  NIO: "NI",
  NOK: "BV NO SJ",
  NPR: "NP",
  NZD: "CK NU NZ PN TK",
  OMR: "OM",
  PAB: "PA",
  PEN: "PE",
  PGK: "PG",
  PHP: "PH",
  PKR: "PK",
  PLN: "PL",
  PYG: "PY",
  QAR: "QA",
  RON: "RO",
  RSD: "RS",
  RUB: "RU",
  RWF: "RW",
  SAR: "SA",
  SBD: "SB",
  SCR: "SC",
  SDG: "SD",
  SEK: "SE",
  SGD: "SG",
  SHP: "AC SH",
  SLE: "SL",
  SOS: "SO",
  SRD: "SR",
  SSP: "SS",
  STN: "ST",
  SYP: "SY",
  SZL: "SZ",
  THB: "TH",
  TJS: "TJ",
  TMT: "TM",
  TND: "TN",
  TOP: "TO",
  TRY: "TR",
  TTD: "TT",
  TWD: "TW",
  TZS: "TZ",
  UAH: "UA",
  UGX: "UG",
  USD: "AS BQ DG EC FM GU IO MH MP PR PW SV TC TL UM US VG VI",
  UYU: "UY",
  UZS: "UZ",
  VES: "VE",
  VND: "VN",
  VUV: "VU",
  WST: "WS",
  XAF: "CF CG CM GA GQ TD",
  XCD: "AG AI DM GD KN LC MS VC",
  XCG: "CW SX",
  XOF: "BF BJ CI GW ML NE SN TG",
  XPF: "NC PF WF",
  YER: "YE",
  ZAR: "LS ZA",
  ZMW: "ZM",
  ZWG: "ZW",
};

const countryCurrencies = new Map<string, string>();
const countryNames = new Map<string, string>();
const regionNames = new Intl.DisplayNames(["en"], { type: "region" });
for (const [currency, regions] of Object.entries(CURRENCY_REGIONS)) {
  for (const code of regions.split(" ")) {
    countryCurrencies.set(code, currency);
    countryNames.set((regionNames.of(code) || code).toLowerCase(), code);
  }
}
const aliases: Record<string, string> = {
  canada: "CA", usa: "US", "united states of america": "US", uk: "GB",
  "great britain": "GB", england: "GB", uae: "AE", "ivory coast": "CI",
};

export function invoiceCurrencyForCountry(country: unknown): string | null {
  if (typeof country !== "string") return null;
  const key = country.trim().toLowerCase();
  const code = aliases[key] || countryNames.get(key) || key.toUpperCase();
  return countryCurrencies.get(code) || null;
}

export function invoiceCurrencyPresentation(
  country: unknown,
  baseCurrency: string,
  rates: Record<string, number> | null,
): { currency: string; rate: number; isEquivalent: boolean } {
  const target = invoiceCurrencyForCountry(country);
  const base = baseCurrency.toUpperCase();
  if (!target || target === base) return { currency: base, rate: 1, isEquivalent: false };
  // The existing FX service is CAD-based. Never relabel an unconverted amount.
  const rate = base === "CAD" ? rates?.[target] : null;
  if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) {
    return { currency: base, rate: 1, isEquivalent: false };
  }
  return { currency: target, rate, isEquivalent: true };
}

/** Display-only rates; a failure leaves the invoice in its original currency. */
export async function getInvoiceCadRates(): Promise<Record<string, number> | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch("https://open.er-api.com/v6/latest/CAD", { signal: controller.signal });
    if (!response.ok) return null;
    const data = await response.json();
    return data?.base_code === "CAD" && data?.rates && typeof data.rates === "object" ? data.rates : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
