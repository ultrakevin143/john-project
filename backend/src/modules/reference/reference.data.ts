export const districtProfile = {
  name: "Cebu Demonstration Water Utility",
  locale: "en-PH",
  timezone: "Asia/Manila",
  currency: "PHP",
  country: "Philippines",
  referenceUtility: "Metropolitan Cebu Water District (MCWD)",
  referenceUrl: "https://www.mcwd.gov.ph/",
  notice:
    "Independent prototype using synthetic records and fictional supply zones. Not affiliated with MCWD.",
  geographyNotice:
    "Four selected Cebu City barangays; this is a demo location list, not MCWD service coverage or hydraulic boundaries.",
  geographyUrl: "https://psa.gov.ph/classification/psgc/barangays/0730600000",
  privacyUrl: "https://privacy.gov.ph/data-privacy-act-/",
  privacyNotice:
    "Restrict customer identity to its declared purpose. Owners approve access, retention and disclosure; retention periods here are prototype policy, not statutory schedules.",
} as const;
export const cebuLocations = [
  { city: "Cebu City", barangay: "Lahug", barangayPsgc: "0730600041" },
  { city: "Cebu City", barangay: "Talamban", barangayPsgc: "0730600081" },
  { city: "Cebu City", barangay: "Guadalupe", barangayPsgc: "0730600029" },
  { city: "Cebu City", barangay: "Banilad", barangayPsgc: "0730600007" },
] as const;

import { manilaDate } from "../../shared/dates.js";
export const standardsUrl =
  "https://www.fda.gov.ph/wp-content/uploads/2021/08/Administrative-Order-No.-2017-0010.pdf";
export const qualityParameters = [
  {
    code: "CL",
    name: "Free residual chlorine",
    unit: "mg/L",
    plausibleMin: 0,
    plausibleMax: 10,
    limitMin: 0.3,
    limitMax: 1.5,
    referenceSection: "Annex A, Table A-6",
    method: "DPD colorimetric",
    monitoringIntervalHours: 24,
  },
  {
    code: "TURB",
    name: "Turbidity",
    unit: "NTU",
    plausibleMin: 0,
    plausibleMax: 1000,
    limitMin: 0,
    limitMax: 5,
    referenceSection: "Annex A; physical and chemical acceptability",
    method: "Nephelometric",
    monitoringIntervalHours: 168,
  },
  {
    code: "PH",
    name: "pH",
    unit: "pH",
    plausibleMin: 0,
    plausibleMax: 14,
    limitMin: 6.5,
    limitMax: 8.5,
    referenceSection: "Annex A; physical and chemical acceptability",
    method: "Electrometric",
    monitoringIntervalHours: 168,
  },
  {
    code: "COLI",
    name: "Total coliform (membrane filtration)",
    unit: "CFU/100mL",
    plausibleMin: 0,
    plausibleMax: 100000,
    limitMin: 0,
    limitMax: 0,
    referenceSection: "Annex A, Table A-1; MFT <1 colony/100 mL",
    method: "Membrane filtration; integer colony count",
    monitoringIntervalHours: 720,
  },
].map((p) => ({
  ...p,
  standardCode: "PNSDW-2017 / AO 2017-0010",
  standardUrl: standardsUrl,
  guidance:
    "Reference limits for treated drinking water; not a potability certificate. The monitoring interval is a demo operational reminder, not the statutory sampling frequency. Confirm current applicability, method, laboratory accreditation and approved Water Safety Plan before operational use.",
}));
export const demonstrationTariffs = [
  {
    code: "RES",
    name: "Residential · illustrative 2026",
    customerClass: "RESIDENTIAL",
    baseVolumeM3: 10,
    baseCharge: 180,
    ratePerM3: 30,
    blocks: [
      { upToM3: 20, rate: 20 },
      { upToM3: 30, rate: 25 },
      { upToM3: null, rate: 30 },
    ],
  },
  {
    code: "COM",
    name: "Commercial · illustrative 2026",
    customerClass: "COMMERCIAL",
    baseVolumeM3: 10,
    baseCharge: 360,
    ratePerM3: 60,
    blocks: [
      { upToM3: 20, rate: 40 },
      { upToM3: 30, rate: 50 },
      { upToM3: null, rate: 60 },
    ],
  },
].map((t) => ({
  ...t,
  meterSizeMm: 15,
  currency: "PHP",
  effectiveFrom: manilaDate("2026-01-01"),
  sourceLabel:
    "Illustrative Cebu prototype tariff; not an approved MCWD rate. Water charge only; excludes taxes, discounts and other fees.",
  demoOnly: true,
}));
