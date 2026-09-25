import type { EventAdapter, InteractionEvent } from '../core/types';
import type { GameSession } from '../core/GameSession';

let eventSequence = 0;
export const DEMO_SUPPORTERS = Array.from({ length: 18 }, (_, i) => ({ id: `support-${i}`, name: `演示·街坊${i + 1}` }));
export function mockEvent(sessionId: string, viewerId: string, displayName: string, text: string): InteractionEvent {
  return { eventId: `mock-${++eventSequence}`, sessionId, viewerId, displayName, receivedAtMs: Date.now(), source: 'mock', payload: { type: 'chat', text } };
}

// Uses game ticks rather than timers, so pause, speed changes and restart share one clock.
export class MockAdapter implements EventAdapter {
  private emit: ((event: InteractionEvent) => void) | null = null;
  private nextCheer = 0;
  private supporter = 0;
  private voted = 0;
  private rallied = false;
  private returned = false;
  private seeded = false;
  constructor(private readonly session: GameSession) {}

  start(emit: (event: InteractionEvent) => void) {
    this.emit = emit;
    if (!this.seeded) {
      this.seeded = true;
      ['火炮', '冰塔', '雷塔'].forEach((kind, i) => this.send(`demo-${i}`, ['演示·星火', '演示·霜序', '演示·惊蛰'][i], `加入 ${kind}`));
    }
  }
  stop() { this.emit = null; }

  update() {
    if (!this.emit || this.session.phase !== 'playing' || this.session.paused) return;
    const time = this.session.battleTick;
    if (time >= this.nextCheer) {
      const viewer = DEMO_SUPPORTERS[this.supporter++ % DEMO_SUPPORTERS.length];
      this.send(viewer.id, viewer.name, '助威');
      this.nextCheer = time + 15;
    }
    if (this.session.vote && this.voted < this.session.vote.round) {
      this.voted = this.session.vote.round;
      for (let i = 0; i < 9; i++) this.send(DEMO_SUPPORTERS[i].id, DEMO_SUPPORTERS[i].name, i < 6 ? '1' : '3');
    }
    if (this.session.wave === 6 && !this.rallied) {
      this.rallied = true;
      this.send('demo-0', '演示·星火', '中路');
      this.send('demo-2', '演示·惊蛰', '中路');
    }
    if (this.rallied && !this.returned && !this.session.enemies.some(enemy => enemy.kind === 'boss')) {
      this.returned = true;
      this.send('demo-0', '演示·星火', '上路');
      this.send('demo-2', '演示·惊蛰', '下路');
    }
  }

  private send(id: string, name: string, text: string) {
    this.emit?.(mockEvent(this.session.id, id, name, text));
  }
}
