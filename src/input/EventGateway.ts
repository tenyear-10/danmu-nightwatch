import { RULES } from '../config/balance';
import type { InteractionEvent } from '../core/types';

export class EventGateway {
  readonly stats = { received: 0, accepted: 0, processed: 0, duplicate: 0, rateLimited: 0, overflow: 0, invalid: 0, stale: 0, paused: 0, cooldown: 0 };
  readonly queue: InteractionEvent[] = [];
  private seen = new Set<string>();
  private rate = new Map<string, { window: number; count: number }>();

  receive(event: InteractionEvent, sessionId: string, clock: number, blocked: boolean): boolean {
    this.stats.received++;
    if (!event || typeof event.eventId !== 'string' || !event.eventId || event.eventId.length > 128 ||
        typeof event.viewerId !== 'string' || !event.viewerId || event.viewerId.length > 80 ||
        typeof event.displayName !== 'string' || event.displayName.length > 100 ||
        !event.payload || event.payload.type !== 'chat' || typeof event.payload.text !== 'string' || event.payload.text.length > 80 ||
        !['mock', 'platform'].includes(event.source) || !Number.isFinite(event.receivedAtMs)) {
      this.stats.invalid++; return false;
    }
    if (event.sessionId !== sessionId) { this.stats.stale++; return false; }
    if (blocked) { this.stats.paused++; return false; }
    if (this.seen.has(event.eventId)) { this.stats.duplicate++; return false; }
    const second = Math.floor(clock / RULES.tickRate);
    const rate = this.rate.get(event.viewerId);
    if (!rate && this.rate.size >= RULES.maxViewers) { this.stats.overflow++; return false; }
    if (rate?.window === second && rate.count >= RULES.ratePerSecond) { this.stats.rateLimited++; return false; }
    if (this.queue.length >= RULES.queueCapacity) { this.stats.overflow++; return false; }
    this.rate.set(event.viewerId, { window: second, count: rate?.window === second ? rate.count + 1 : 1 });
    this.seen.add(event.eventId);
    if (this.seen.size > RULES.dedupCapacity) this.seen.delete(this.seen.values().next().value!);
    this.queue.push({ ...event, payload: { ...event.payload } });
    this.stats.accepted++;
    return true;
  }

  drain(): InteractionEvent[] {
    const batch = this.queue.splice(0, RULES.perTick);
    this.stats.processed += batch.length;
    return batch;
  }
}
