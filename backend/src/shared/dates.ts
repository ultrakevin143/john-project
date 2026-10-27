// Manila calendar boundaries use the fixed +08:00 offset.
const offset = 8 * 3600000;

export function manilaDate(value: string) {
  return new Date(`${value}T00:00:00+08:00`);
}
export function manilaMonthStart(now: Date, monthOffset = 0) {
  const local = new Date(now.getTime() + offset);
  return new Date(
    Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + monthOffset, 1) -
      offset,
  );
}
