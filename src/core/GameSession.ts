import { ENEMIES, LANES, LANE_Y, RULES, SLOT_X, TOWERS, UPGRADES, WAVES, WAVE_NAMES } from '../config/balance';
import { parseCommand } from '../input/commands';
import { EventGateway } from '../input/EventGateway';
import type { Effect, Enemy, EnemyKind, Feedback, InteractionEvent, Lane, Mode, Phase, Tower, Viewer, Vote } from './types';

let sessionSequence = 0;
export class GameSession {
  readonly id = `night-${Date.now()}-${++sessionSequence}`;
  readonly gateway = new EventGateway();
  phase: Phase = 'lobby';
  paused = false;
  clock = 0;
  battleTick = 0;
  countdown = RULES.countdown * RULES.tickRate;
  gateHp: number = RULES.gateHp;
  wave = 0;
  kills = 0;
  totalDamage = 0;
  energy = 0;
  thunderReady = 0;
  thunderCount = 0;
  damageMultiplier = 1;
  intervalMultiplier = 1;
  viewers = new Map<string, Viewer>();
  towers: Tower[] = [];
  enemies: Enemy[] = [];
  pending: { at: number; kind: EnemyKind; lane: Lane; multiplier: number; x: number }[] = [];
  vote: Vote | null = null;
  completedVotes = 0;
  upgrades: string[] = [];
  logs: Feedback[] = [];
  effects: Effect[] = [];
  result: { won: boolean; reason: string } | null = null;
  private serial = 0;

  constructor(readonly mode: Mode = 'demo') {
    this.log('守夜人', '夜幕将至。部署炮塔，守住三条防线。');
  }

  get seconds() { return this.battleTick / RULES.tickRate; }
  get remaining() { return Math.max(0, RULES.duration - this.seconds); }
  get voteCounts() {
    const values = [0, 0, 0];
    this.vote?.ballots.forEach(choice => values[choice]++);
    return values;
  }

  receive(event: InteractionEvent) {
    return this.gateway.receive(event, this.id, this.clock, this.paused || this.phase === 'result');
  }

  start() {
    if (this.phase !== 'lobby' || this.towers.length === 0) return false;
    this.phase = 'countdown';
    this.log('守夜人', '准备迎敌，五秒后开始守城。', 'good');
    return true;
  }

  tick() {
    if (this.paused || this.phase === 'result') return;
    this.clock++;
    this.effects = this.effects.filter(effect => this.clock - effect.tick < (effect.type === 'wave' || effect.type === 'upgrade' ? 90 : 36));
    if (this.phase === 'countdown' && --this.countdown <= 0) this.phase = 'playing';
    if (this.phase === 'playing') this.schedule();
    for (const event of this.gateway.drain()) this.handle(event);
    if (this.phase !== 'playing') return;
    this.closeVote();
    this.attack();
    this.thunder();
    this.moveEnemies();
    this.enemies = this.enemies.filter(enemy => enemy.hp > 0 && enemy.x > RULES.gateX);
    if (this.gateHp <= 0) this.finish(false, '城门失守');
    else if (this.wave === WAVES.length && !this.enemies.length && !this.pending.length) this.finish(true, '长夜终尽，黎明已至');
    else if (this.battleTick >= RULES.duration * RULES.tickRate) this.finish(false, '未能在黎明前消灭所有敌人');
    else this.battleTick++;
  }

  log(name: string, text: string, tone: Feedback['tone'] = 'info', viewerId?: string) {
    this.logs.push({ id: ++this.serial, at: this.seconds, name, text, tone, viewerId });
    if (this.logs.length > 50) this.logs.shift();
  }

  private emit(type: Effect['type'], x: number, y: number, color: number, toX?: number, label?: string) {
    this.effects.push({ id: ++this.serial, tick: this.clock, type, x, y, color, toX, label });
    if (this.effects.length > 200) this.effects.shift();
  }

  private handle(event: InteractionEvent) {
    const command = parseCommand(event.payload.text);
    const name = Array.from(event.displayName.trim() || '无名守夜人').slice(0, 12).join('');
    const reply = (text: string, tone: Feedback['tone'] = 'info') => this.log(name, text, tone, event.viewerId);
    if (!command) { reply(`${event.payload.text.trim()} · 普通弹幕，不会触发操作`); return; }
    let viewer = this.viewers.get(event.viewerId);
    if (!viewer) {
      if (this.viewers.size >= RULES.maxViewers) { reply('演示观众已达 200 人上限', 'warn'); return; }
      viewer = { id: event.viewerId, name, damage: 0, cheers: 0, moveReady: 0, cheerReady: 0 };
      this.viewers.set(viewer.id, viewer);
    }
    viewer.name = name;
    const tower = this.towers.find(item => item.id === viewer.id);
    switch (command.type) {
      case 'join': {
        if (tower) { reply('已经加入，发送路线名称即可换防'); return; }
        if (this.towers.length >= RULES.maxTowers) { reply('炮位已满，可助威或投票', 'warn'); return; }
        const lane = ([0, 1, 2] as Lane[]).sort((a, b) => {
          const count = this.towers.filter(t => t.lane === a).length - this.towers.filter(t => t.lane === b).length;
          return count || this.towers.filter(t => t.lane === a && t.kind === command.kind).length - this.towers.filter(t => t.lane === b && t.kind === command.kind).length;
        })[0];
        const slot = this.freeSlot(lane);
        this.towers.push({ id: viewer.id, kind: command.kind, lane, slot, nextAttack: this.clock, joined: this.clock, lastAttack: -100 });
        reply(`${TOWERS[command.kind].name}已部署到${LANES[lane]}`, 'good');
        this.emit('join', SLOT_X[slot], LANE_Y[lane] - 42, TOWERS[command.kind].color);
        break;
      }
      case 'move': {
        if (!tower) { reply('先发送“加入 火炮”等指令部署炮塔', 'warn'); return; }
        if (tower.lane === command.lane) { reply(`已经在${LANES[command.lane]}`); return; }
        if (viewer.moveReady > this.clock) { this.cooldown(viewer, '换防', viewer.moveReady); return; }
        const slot = this.freeSlot(command.lane);
        if (slot < 0) { reply(`${LANES[command.lane]}炮位已满`, 'warn'); return; }
        tower.lane = command.lane;
        tower.slot = slot;
        tower.joined = this.clock;
        viewer.moveReady = this.clock + RULES.moveCooldown * RULES.tickRate;
        reply(`已换防至${LANES[command.lane]}`, 'good');
        this.emit('join', SLOT_X[slot], LANE_Y[tower.lane] - 42, TOWERS[tower.kind].color);
        break;
      }
      case 'cheer': {
        if (this.phase !== 'playing') { reply('战斗开始后即可助威'); return; }
        if (viewer.cheerReady > this.clock) { this.cooldown(viewer, '助威', viewer.cheerReady); return; }
        viewer.cheerReady = this.clock + RULES.cheerCooldown * RULES.tickRate;
        viewer.cheers++;
        this.energy = Math.min(RULES.energyMax, this.energy + 1);
        reply(this.energy === RULES.energyMax ? '助威收到 · 雷暴能量已满' : '为守夜城助威 · 能量 +1', 'good');
        break;
      }
      case 'vote': {
        if (!this.vote || this.battleTick < this.vote.start || this.battleTick >= this.vote.end) {
          reply('当前没有进行中的投票'); return;
        }
        this.vote.ballots.set(viewer.id, command.choice);
        reply(`投票 ${command.choice + 1} · ${UPGRADES[command.choice]}`, 'good');
        break;
      }
    }
  }

  private cooldown(viewer: Viewer, label: string, until: number) {
    this.gateway.stats.cooldown++;
    this.log(viewer.name, `${label}冷却中，还需 ${Math.ceil((until - this.clock) / RULES.tickRate)} 秒`, 'warn', viewer.id);
  }

  private freeSlot(lane: Lane) {
    return [0, 1, 2, 3].find(slot => !this.towers.some(t => t.lane === lane && t.slot === slot)) ?? -1;
  }

  private schedule() {
    if (this.wave < WAVES.length && this.battleTick >= this.wave * 30 * RULES.tickRate) {
      const multiplier = Math.min(2, Math.max(0.75, Math.sqrt(this.towers.length / 3)));
      const count = WAVES[this.wave];
      this.wave++;
      const x = this.wave === 1 ? RULES.openingSpawnX : this.wave === 6 ? RULES.finalWaveSpawnX : RULES.spawnX;
      for (let i = 0; i < count; i++) {
        const kind: EnemyKind = this.wave >= 5 && i % 5 === 0 ? 'armor' : this.wave >= 3 && i % 3 === 1 ? 'fast' : 'normal';
        this.pending.push({ at: this.battleTick + i * RULES.tickRate, kind, lane: i % 3 as Lane, multiplier, x });
      }
      if (this.wave === 6) this.pending.unshift({ at: this.battleTick, kind: 'boss', lane: 1, multiplier, x: RULES.bossSpawnX });
      this.log('守夜人', this.wave === 6 ? '蚀夜巨像出现！集中火力守住中路。' : `第 ${this.wave} 波来袭，守住防线。`, 'warn');
      this.emit('wave', 640, 115, this.wave === 6 ? 0xf2837f : 0xf4b66a, undefined, this.wave === 6 ? '首领 · 蚀夜巨像' : `第 ${this.wave} 波 · ${WAVE_NAMES[this.wave - 1]}`);
    }
    while (this.pending.length && this.pending[0].at <= this.battleTick && this.enemies.length < RULES.maxEnemies) {
      const entry = this.pending.shift()!;
      const hp = ENEMIES[entry.kind].hp * entry.multiplier;
      this.enemies.push({ id: ++this.serial, kind: entry.kind, lane: entry.lane, x: entry.x, hp, maxHp: hp, slowUntil: 0, born: this.clock });
    }
    const start = (this.completedVotes + 1) * 60 * RULES.tickRate;
    if (!this.vote && this.completedVotes < 2 && this.battleTick >= start) {
      this.vote = { round: this.completedVotes + 1, start, end: start + RULES.voteDuration * RULES.tickRate, ballots: new Map() };
      this.log('议事厅', '升级投票开启！发送 1 / 2 / 3 决定全队升级。', 'good');
    }
  }

  private closeVote() {
    if (!this.vote || this.battleTick < this.vote.end) return;
    const counts = this.voteCounts;
    const choice = counts.indexOf(Math.max(...counts));
    if (choice === 0) this.damageMultiplier *= 1.15;
    else if (choice === 1) this.gateHp = Math.min(RULES.gateHp, this.gateHp + 20);
    else this.intervalMultiplier *= 0.9;
    this.upgrades.push(UPGRADES[choice]);
    this.log('议事厅', `升级生效：${UPGRADES[choice]}`, 'good');
    this.emit('upgrade', 640, 180, 0xa6e0b8, undefined, UPGRADES[choice]);
    this.completedVotes++;
    this.vote = null;
  }

  private hurt(enemy: Enemy, damage: number, viewer?: Viewer, color = 0xb3a0ff) {
    const actual = Math.min(Math.max(0, enemy.hp), damage);
    enemy.hp -= actual;
    this.totalDamage += actual;
    if (viewer) viewer.damage += actual;
    if (actual > 0) {
      enemy.lastHit = this.clock;
      this.emit('hit', enemy.x, LANE_Y[enemy.lane] - 32, color, undefined, `${Math.round(actual)}`);
    }
    if (actual > 0 && enemy.hp <= 0) {
      this.kills++;
      this.emit('kill', enemy.x, LANE_Y[enemy.lane] - 10, enemy.kind === 'boss' ? 0xf4b66a : 0x7dd8be);
    }
  }

  private attack() {
    for (const tower of this.towers) {
      if (tower.nextAttack > this.clock) continue;
      const spec = TOWERS[tower.kind];
      const x = SLOT_X[tower.slot];
      const targets = this.enemies.filter(enemy => enemy.hp > 0 && enemy.lane === tower.lane && Math.abs(enemy.x - x) <= spec.range).sort((a, b) => a.x - b.x).slice(0, tower.kind === 'tesla' ? 3 : 1);
      if (!targets.length) continue;
      for (const target of targets) {
        this.hurt(target, spec.damage * this.damageMultiplier, this.viewers.get(tower.id), spec.color);
        if (tower.kind === 'ice') target.slowUntil = this.clock + 2 * RULES.tickRate;
        this.emit('shot', x + 12, LANE_Y[tower.lane] - 40, spec.color, target.x);
      }
      tower.nextAttack = this.clock + Math.ceil(spec.interval * this.intervalMultiplier * RULES.tickRate);
      tower.lastAttack = this.clock;
    }
  }

  private thunder() {
    if (this.energy < RULES.energyMax || this.thunderReady > this.clock || !this.enemies.some(enemy => enemy.hp > 0)) return;
    this.energy = 0;
    this.thunderReady = this.clock + RULES.thunderCooldown * RULES.tickRate;
    this.thunderCount++;
    for (const enemy of this.enemies) this.hurt(enemy, RULES.thunderDamage);
    this.emit('thunder', 640, 330, 0xb3a0ff);
    this.log('全体守夜人', '雷暴降临！全场敌人受到 35 点伤害。', 'good');
  }

  private moveEnemies() {
    for (const enemy of this.enemies) {
      if (enemy.hp <= 0) continue;
      const spec = ENEMIES[enemy.kind];
      const slow = enemy.slowUntil > this.clock ? 0.7 : 1;
      const rage = enemy.kind === 'boss' && (this.clock - enemy.born) % (10 * RULES.tickRate) < 2 * RULES.tickRate ? 1.5 : 1;
      enemy.x -= spec.speed * slow * rage / RULES.tickRate;
      if (enemy.x <= RULES.gateX) {
        this.gateHp = Math.max(0, this.gateHp - spec.gateDamage);
        this.emit('gate', RULES.gateX, LANE_Y[enemy.lane], 0xf2837f);
        this.log('城门', `${spec.name}突破${LANES[enemy.lane]} · 耐久 −${spec.gateDamage}`, 'warn');
      }
    }
  }

  private finish(won: boolean, reason: string) {
    this.phase = 'result';
    this.result = { won, reason };
    this.vote = null;
    this.gateway.queue.length = 0;
    this.log('守夜人', reason, won ? 'good' : 'warn');
    this.emit('result', 640, 360, won ? 0xa6e0b8 : 0xf2837f);
  }
}
