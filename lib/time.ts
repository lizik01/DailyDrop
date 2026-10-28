/** The subscriber-local hour (0–23) and calendar day (YYYY-MM-DD) for a given instant. */
export function localClock(timezone: string, at = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  )
  return { hour: Number(parts.hour), day: `${parts.year}-${parts.month}-${parts.day}` }
}
