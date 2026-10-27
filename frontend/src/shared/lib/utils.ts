import { clsx,type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
export const number = (value: number | null | undefined, digits = 0) =>
  value === null || value === undefined
    ? "—"
    : new Intl.NumberFormat("en-PH", {
        maximumFractionDigits: digits,
        minimumFractionDigits: digits,
      }).format(value);
export const dateTime = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("en-PH", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Manila",
      }).format(new Date(value)) + " PHT"
    : "No successful import";
export const pesos = (value: number) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(
    value,
  );
export const label = (value: string) =>
  value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
