import test from 'node:test';
import assert from 'node:assert/strict';
import { filterRelevantHistory } from './history.js';

test('ignores short unknown-origin incidents from metrics counts', () => {
  const history = [
    { timestamp: '2026-08-08T10:00:00Z', duration_minutes: 20, cause_final: 'unknown', cause_provisional: 'unknown' },
    { timestamp: '2026-08-08T11:00:00Z', duration_minutes: 90, cause_final: 'interno_firewall', cause_provisional: 'unknown' },
    { timestamp: '2026-08-08T12:00:00Z', duration_minutes: 30, cause_final: 'externo', cause_provisional: 'unknown' },
    { timestamp: '2026-08-08T13:00:00Z', duration_minutes: 0, cause_final: 'unknown', cause_provisional: 'unknown' },
    { timestamp: '2026-08-08T14:00:00Z', duration_minutes: 60, cause_final: 'unknown', cause_provisional: 'unknown' },
  ];

  const filtered = filterRelevantHistory(history);

  assert.equal(filtered.length, 3);
  assert.deepEqual(filtered.map(item => item.timestamp), ['2026-08-08T11:00:00Z', '2026-08-08T12:00:00Z', '2026-08-08T14:00:00Z']);
});
