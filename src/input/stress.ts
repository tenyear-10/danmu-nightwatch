import { RULES } from '../config/balance';
import { DEMO_SUPPORTERS } from './MockAdapter';

// Reserve the entire automatic audience, including viewers who have not spoken yet.
// Otherwise synthetic identities can consume their slots while the adapter is stopped.
export function stressIdentities(existing: Iterable<{ id: string; name: string }>, resumeDemo: boolean) {
  const pool = new Map(Array.from(existing, viewer => [viewer.id, { id: viewer.id, name: viewer.name }]));
  if (resumeDemo) {
    for (const viewer of DEMO_SUPPORTERS) {
      if (!pool.has(viewer.id) && pool.size < RULES.maxViewers) pool.set(viewer.id, viewer);
    }
  }
  for (let i = 0; pool.size < RULES.maxViewers; i++) {
    const id = `stress-${i}`;
    if (!pool.has(id)) pool.set(id, { id, name: `压测·${i + 1}` });
  }
  return [...pool.values()];
}
