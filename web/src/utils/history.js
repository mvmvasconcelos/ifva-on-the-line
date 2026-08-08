export function isRelevantHistoryEvent(event) {
  if (!event || typeof event !== 'object') {
    return false;
  }

  const durationMinutes = Number(event.duration_minutes ?? 0);
  const causeFinal = event.cause_final ?? event.cause_provisional ?? 'unknown';
  const causeText = String(causeFinal ?? '').trim().toLowerCase();

  const hasKnownCause = causeText !== '' && causeText !== 'unknown';
  const isShortUnknown = Number.isFinite(durationMinutes) && durationMinutes >= 0 && durationMinutes < 50 && !hasKnownCause;

  return !isShortUnknown;
}

export function filterRelevantHistory(history = []) {
  if (!Array.isArray(history)) {
    return [];
  }

  return history.filter(isRelevantHistoryEvent);
}
