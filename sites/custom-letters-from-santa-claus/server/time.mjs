// America/Chicago instants for the order-by clock. December and late November
// 2026 are Central Standard Time (UTC-6). The conversion is checked against
// those dates rather than a hardcoded offset so a DST date still lands right.

export function chicagoParts(date) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const bag = { year: 0, month: 0, day: 0, hour: 0, minute: 0, second: 0 };
  for (const part of fmt.formatToParts(date)) {
    if (part.type in bag) bag[part.type] = Number(part.value);
  }
  if (bag.hour === 24) bag.hour = 0;
  return bag;
}

export function chicagoDateString(date) {
  const p = chicagoParts(date);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

// Local Chicago wall time as a UTC Date. Iterates because the offset is only
// known once we have a candidate instant.
export function chicagoInstant(year, month, day, hour = 0, minute = 0, second = 0) {
  const want = Date.UTC(year, month - 1, day, hour, minute, second);
  let guess = new Date(want);
  for (let i = 0; i < 4; i += 1) {
    const p = chicagoParts(guess);
    const got = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    const diff = want - got;
    if (diff === 0) return guess;
    guess = new Date(guess.getTime() + diff);
  }
  return guess;
}

export function atOrBefore(now, deadline) {
  return now.getTime() <= deadline.getTime();
}
