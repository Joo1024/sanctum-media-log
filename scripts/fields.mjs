import { TYPES, STATUSES } from '../src/lib.mjs';

for (const [field, choices] of Object.entries({ type: TYPES, 'history[].status': STATUSES })) {
  console.log(`${field}：`);
  for (const [value, label] of Object.entries(choices)) console.log(`  ${value}：${label}`);
}
