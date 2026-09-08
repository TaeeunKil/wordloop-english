/** Date-only arithmetic uses UTC to avoid DST and browser time-zone shifts. */
export function dayKey(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const part = (name: string) => parts.find(p => p.type === name)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
export function shiftDay(day: string, offset: number) {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}
export function activityDays(days: { day: string; reviews: number }[], today: string) {
  const counts = new Map(days.map(day => [day.day, day.reviews]));
  return Array.from({ length: 30 }, (_, i) => {
    const day = shiftDay(today, i - 29);
    return { day, reviews: counts.get(day) ?? 0 };
  });
}
export function currentStreak(days: { day: string; reviews: number }[], today: string) {
  const active = new Set(activityDays(days, today).filter(day => day.reviews > 0).map(day => day.day));
  let day = active.has(today) ? today : shiftDay(today, -1);
  let count = 0;
  while (active.has(day)) { count++; day = shiftDay(day, -1); }
  return count;
}
export function reviewDate(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("ko-KR", { timeZone, month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}
