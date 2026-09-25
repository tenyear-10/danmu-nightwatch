export type Lane = 0 | 1 | 2;
export type TowerKind = 'cannon' | 'ice' | 'tesla';
export type EnemyKind = 'normal' | 'fast' | 'armor' | 'boss';
export type Phase = 'lobby' | 'countdown' | 'playing' | 'result';
export type Mode = 'demo' | 'manual';

export interface InteractionEvent {
  eventId: string;
  sessionId: string;
  viewerId: string;
  displayName: string;
  receivedAtMs: number;
  source: 'mock' | 'platform';
  payload: { type: 'chat'; text: string };
}
export interface EventAdapter {
  start(emit: (event: InteractionEvent) => void): void;
  stop(): void;
}
export type Command =
  | { type: 'join'; kind: TowerKind }
  | { type: 'move'; lane: Lane }
  | { type: 'cheer' }
  | { type: 'vote'; choice: 0 | 1 | 2 };

export interface Viewer {
  id: string;
  name: string;
  damage: number;
  cheers: number;
  moveReady: number;
  cheerReady: number;
}
export interface Tower {
  id: string;
  kind: TowerKind;
  lane: Lane;
  slot: number;
  nextAttack: number;
  joined: number;
  lastAttack: number;
}
export interface Enemy {
  id: number;
  kind: EnemyKind;
  lane: Lane;
  x: number;
  hp: number;
  maxHp: number;
  slowUntil: number;
  born: number;
  lastHit?: number;
}
export interface Vote {
  round: number;
  start: number;
  end: number;
  ballots: Map<string, 0 | 1 | 2>;
}
export interface Feedback {
  id: number;
  at: number;
  name: string;
  text: string;
  tone: 'info' | 'good' | 'warn';
  viewerId?: string;
}
export interface Effect {
  id: number;
  tick: number;
  type: 'shot' | 'hit' | 'kill' | 'thunder' | 'join' | 'gate' | 'upgrade' | 'wave' | 'result';
  x: number;
  y: number;
  toX?: number;
  color: number;
  label?: string;
}
