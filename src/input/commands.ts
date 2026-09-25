import type { Command } from '../core/types';

export function parseCommand(text: string): Command | null {
  const value = text.trim().replace(/\s+/g, ' ');
  const join = /^(?:加入|召唤) ?(火炮|冰塔|雷塔)$/.exec(value);
  if (join) {
    const kinds = { 火炮: 'cannon', 冰塔: 'ice', 雷塔: 'tesla' } as const;
    return { type: 'join', kind: kinds[join[1] as keyof typeof kinds] };
  }
  if (value === '上路') return { type: 'move', lane: 0 };
  if (value === '中路') return { type: 'move', lane: 1 };
  if (value === '下路') return { type: 'move', lane: 2 };
  if (value === '助威') return { type: 'cheer' };
  if (/^[123]$/.test(value)) return { type: 'vote', choice: (Number(value) - 1) as 0 | 1 | 2 };
  return null;
}
