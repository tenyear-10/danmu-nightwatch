import { describe, expect, it } from 'vitest';
import { GameSession } from '../src/core/GameSession';
import { parseCommand } from '../src/input/commands';
import { EventGateway } from '../src/input/EventGateway';
import { MockAdapter, mockEvent } from '../src/input/MockAdapter';
import { stressIdentities } from '../src/input/stress';
import { battleAdvice } from '../src/core/advice';
import { RULES } from '../src/config/balance';
import type { Enemy, InteractionEvent } from '../src/core/types';

function send(s: GameSession, id: string, command: string, name = id) {
  const event = mockEvent(s.id, id, name, command);
  s.receive(event); s.tick(); return event;
}
function ticks(s: GameSession, count: number) { for (let i = 0; i < count; i++) s.tick(); }
function enemy(overrides: Partial<Enemy> = {}): Enemy {
  return { id: 10001, kind: 'normal', lane: 0, x: 700, hp: 45, maxHp: 45, slowUntil: 0, born: 0, ...overrides };
}
function arena(kind = '火炮') {
  const s = new GameSession('manual');
  send(s, 'p1', `加入 ${kind}`);
  s.phase = 'playing'; s.wave = 6;
  s.enemies = [enemy()];
  return s;
}

describe('弹幕解析', () => {
  it('只接受明确指令，规范空白', () => {
    expect(parseCommand('  加入   火炮 ')).toEqual({ type: 'join', kind: 'cannon' });
    expect(parseCommand('召唤火炮')).toEqual({ type: 'join', kind: 'cannon' });
    expect(parseCommand('召唤 冰塔')).toEqual({ type: 'join', kind: 'ice' });
    expect(parseCommand('加入雷塔')).toEqual({ type: 'join', kind: 'tesla' });
    expect(parseCommand('中路')).toEqual({ type: 'move', lane: 1 });
    expect(parseCommand('3')).toEqual({ type: 'vote', choice: 2 });
    expect(parseCommand('帮我加入火炮好吗')).toBeNull();
    expect(parseCommand('constructor')).toBeNull();
  });
  it('召唤指令会部署炮塔，普通聊天会明确提示不触发操作', () => {
    const session = new GameSession('manual');
    send(session, 'p1', '召唤火炮');
    expect(session.towers).toMatchObject([{ id: 'p1', kind: 'cannon' }]);
    expect(session.logs.at(-1)?.text).toContain('已部署');
    send(session, 'p2', '今晚天气不错');
    expect(session.towers).toHaveLength(1);
    expect(session.logs.at(-1)?.text).toContain('普通弹幕');
  });
});

describe('事件入口', () => {
  it('拒绝重复、旧局和暂停事件', () => {
    const gateway = new EventGateway();
    const event = mockEvent('s1', 'one', 'one', '助威');
    expect(gateway.receive(event, 's1', 0, false)).toBe(true);
    expect(gateway.receive(event, 's1', 0, false)).toBe(false);
    expect(gateway.receive({ ...event, eventId: 'other' }, 's2', 0, false)).toBe(false);
    expect(gateway.receive({ ...event, eventId: 'pause' }, 's1', 0, true)).toBe(false);
    expect(gateway.stats).toMatchObject({ duplicate: 1, stale: 1, paused: 1 });
  });
  it('校验运行时形状，拒绝超长输入', () => {
    const gateway = new EventGateway();
    expect(gateway.receive(null as unknown as InteractionEvent, 's', 0, false)).toBe(false);
    expect(gateway.receive(mockEvent('s', 'p', 'p', 'a'.repeat(81)), 's', 0, false)).toBe(false);
    expect(gateway.stats.invalid).toBe(2);
  });
  it('每秒五条限流与有界队列', () => {
    const gateway = new EventGateway();
    for (let i = 0; i < 6; i++) gateway.receive(mockEvent('s', 'p', 'p', '助威'), 's', 0, false);
    expect(gateway.stats.rateLimited).toBe(1);
    expect(gateway.receive(mockEvent('s', 'p', 'p', '助威'), 's', 30, false)).toBe(true);
    for (let i = 0; i < 600; i++) gateway.receive(mockEvent('s', `p${i % 150}`, 'p', '助威'), 's', 30, false);
    expect(gateway.queue).toHaveLength(500);
    expect(gateway.drain()).toHaveLength(20);
    expect(gateway.stats.overflow).toBeGreaterThan(0);
  });
});

describe('身份、炮位与冷却', () => {
  it('相同昵称按 ID 区分，重复加入不改变职业', () => {
    const s = new GameSession();
    send(s, 'a', '加入 火炮', '同名'); send(s, 'b', '加入 冰塔', '同名'); send(s, 'a', '加入 雷塔', '同名');
    expect(s.towers).toHaveLength(2);
    expect(s.towers[0].kind).toBe('cannon');
    expect(s.towers.map(t => t.lane)).toEqual([0, 1]);
  });
  it('最多十二座炮塔，满员观众仍可助威', () => {
    const s = new GameSession();
    for (let i = 0; i < 13; i++) send(s, `p${i}`, '加入 火炮');
    expect(s.towers).toHaveLength(12);
    s.phase = 'playing'; send(s, 'p12', '助威');
    expect(s.viewers.get('p12')?.cheers).toBe(1);
  });
  it('换防满路不消耗冷却，成功后五秒才能再换', () => {
    const s = new GameSession();
    for (let i = 0; i < 10; i++) send(s, `p${i}`, '加入 火炮');
    send(s, 'p1', '上路');
    expect(s.towers.find(t => t.id === 'p1')?.lane).toBe(1);
    expect(s.viewers.get('p1')?.moveReady).toBe(0);
    send(s, 'p1', '下路'); send(s, 'p1', '中路');
    expect(s.towers.find(t => t.id === 'p1')?.lane).toBe(2);
    expect(s.gateway.stats.cooldown).toBe(1);
    ticks(s, 150); send(s, 'p1', '中路');
    expect(s.towers.find(t => t.id === 'p1')?.lane).toBe(1);
  });
  it('助威冷却使用逻辑时钟，暂停不前进', () => {
    const s = new GameSession(); s.phase = 'playing';
    send(s, 'p', '助威'); send(s, 'p', '助威');
    expect(s.energy).toBe(1);
    const clock = s.clock; s.paused = true; ticks(s, 300);
    expect(s.clock).toBe(clock);
    s.paused = false; ticks(s, 90); send(s, 'p', '助威');
    expect(s.energy).toBe(2);
  });
  it('昵称截断但保留完整 Unicode 字符', () => {
    const s = new GameSession(); send(s, 'p', '加入 火炮', '🌙'.repeat(20));
    expect(Array.from(s.viewers.get('p')!.name)).toHaveLength(12);
  });
});

describe('投票与战斗', () => {
  it('雷暴在空场蓄能，遇敌后释放', () => {
    const s = new GameSession(); s.phase = 'playing'; s.wave = 1; s.energy = 30;
    ticks(s, 90);
    expect(s.energy).toBe(30); expect(s.thunderCount).toBe(0);
    s.enemies.push(enemy({ hp: 10 })); s.tick();
    expect(s.thunderCount).toBe(1); expect(s.energy).toBe(0); expect(s.kills).toBe(1);
  });
  it('均衡人数后优先避免同职业扎堆', () => {
    const s = new GameSession();
    ['火炮', '冰塔', '雷塔', '火炮'].forEach((kind, i) => send(s, `p${i}`, `加入 ${kind}`));
    expect(s.towers[3].lane).toBe(1);
    expect(s.towers.filter(t => t.lane === 0)).toHaveLength(1);
  });
  it('第一波七秒内开始攻击，受击和后坐数据来自实际伤害', () => {
    const s = new GameSession(); send(s, 'p', '加入 火炮'); s.phase = 'playing';
    ticks(s, 7 * RULES.tickRate);
    expect(s.viewers.get('p')!.damage).toBeGreaterThan(0);
    expect(s.towers[0].lastAttack).toBeGreaterThan(0);
    expect(s.effects.some(effect => effect.type === 'hit' && effect.label === '16')).toBe(true);
  });
  it('同昵称反馈按 viewerId 区分，改昵称不重置身份', () => {
    const s = new GameSession(); send(s, 'a', '加入 火炮', '同名'); send(s, 'b', '加入 雷塔', '同名');
    send(s, 'a', '下路', '新昵称');
    expect(s.logs.at(-1)?.viewerId).toBe('a'); expect(s.logs.at(-1)?.name).toBe('新昵称');
    expect(s.viewers.get('a')?.name).toBe('新昵称'); expect(s.towers).toHaveLength(2);
  });
  it('战况建议区分投票、Boss 缺少火炮和失败复盘', () => {
    const s = arena('冰塔'); s.enemies = [enemy({ kind: 'boss', lane: 1 })];
    expect(battleAdvice(s, 'p1').detail).toContain('中路缺少火炮');
    s.vote = { round: 1, start: 0, end: 240, ballots: new Map() };
    expect(battleAdvice(s, 'p1').title).toBe('全城升级投票中');
    s.vote = null; s.result = { won: false, reason: '超时' };
    expect(battleAdvice(s, 'p1').title).toBe('下次试试集中火力');
  });
  it('同人改票仅计最新票，截止帧不收票，平票选较小编号', () => {
    const s = new GameSession(); s.phase = 'playing'; s.battleTick = 1800;
    send(s, 'p', '2'); send(s, 'p', '3'); send(s, 'q', '1');
    expect(s.voteCounts).toEqual([1, 0, 1]);
    s.battleTick = 2040; send(s, 'p', '2');
    expect(s.vote).toBeNull(); expect(s.damageMultiplier).toBe(1.15);
    expect(s.upgrades).toEqual(['全队伤害 +15%']);
  });
  it('修复城门不超过上限，无投票默认选第一项', () => {
    const s = new GameSession(); s.phase = 'playing'; s.battleTick = 1800; s.gateHp = 95;
    send(s, 'p', '2'); s.battleTick = 2040; s.tick(); expect(s.gateHp).toBe(100);
    s.battleTick = 3600; s.tick(); s.battleTick = 3840; s.tick();
    expect(s.damageMultiplier).toBe(1.15);
  });
  it('过量伤害不增加贡献，雷暴归于团队', () => {
    const s = arena(); s.enemies[0].hp = 3; s.tick();
    expect(s.viewers.get('p1')?.damage).toBe(3); expect(s.totalDamage).toBe(3); expect(s.kills).toBe(1);
    const thunder = arena(); thunder.towers[0].nextAttack = 99999; thunder.enemies[0].hp = 10; thunder.energy = 30; thunder.tick();
    expect(thunder.totalDamage).toBe(10); expect(thunder.viewers.get('p1')?.damage).toBe(0); expect(thunder.energy).toBe(0);
  });
  it('冰塔刷新减速，不叠乘；雷塔最多伤害三个目标', () => {
    const ice = arena('冰塔'); ice.tick();
    const x = ice.enemies[0].x; ice.tick();
    expect(x - ice.enemies[0].x).toBeCloseTo(24 * 0.7 / 30);
    ice.towers[0].nextAttack = 0; ice.tick();
    const x2 = ice.enemies[0].x; ice.tick();
    expect(x2 - ice.enemies[0].x).toBeCloseTo(24 * 0.7 / 30);
    const tesla = arena('雷塔'); tesla.enemies = [0, 1, 2, 3].map(id => enemy({ id, x: 600 + id * 10 })); tesla.tick();
    expect(tesla.enemies.map(e => e.hp)).toEqual([39, 39, 39, 45]);
  });
  it('敌人容量满时保留生成队列，不能提前胜利', () => {
    const s = arena(); s.towers[0].nextAttack = 99999;
    s.enemies = Array.from({ length: 120 }, (_, id) => enemy({ id, x: 1100 }));
    s.pending = [{ at: 0, kind: 'normal', lane: 0, multiplier: 1, x: RULES.spawnX }];
    s.tick(); expect(s.pending).toHaveLength(1); expect(s.result).toBeNull();
    s.enemies = []; s.tick(); expect(s.pending).toHaveLength(0); expect(s.enemies).toHaveLength(1); expect(s.result).toBeNull();
  });
  it('城门毁坏优先于清场胜利，清场优先于截止帧超时', () => {
    const loss = arena(); loss.gateHp = 4; loss.towers[0].nextAttack = 99999; loss.enemies[0].x = 200.1; loss.battleTick = 5400;
    loss.tick(); expect(loss.result?.won).toBe(false); expect(loss.result?.reason).toBe('城门失守');
    const win = arena(); win.enemies[0].hp = 1; win.battleTick = 5400; win.tick(); expect(win.result?.won).toBe(true);
    const timeout = arena(); timeout.enemies[0].x = 1100; timeout.battleTick = 5400; timeout.tick(); expect(timeout.result?.reason).toContain('黎明前');
  });
  it('波次快照不会随中途加入改变已有敌人耐久', () => {
    const s = new GameSession(); send(s, 'p', '加入 火炮'); s.phase = 'playing'; s.tick();
    const hp = s.enemies[0].maxHp;
    for (let i = 0; i < 8; i++) send(s, `n${i}`, '加入 火炮');
    expect(s.enemies[0].maxHp).toBe(hp);
    expect(s.pending.every(entry => entry.multiplier === 0.75)).toBe(true);
  });
});

describe('整局与压力回归', () => {
  it('压测预留尚未发言的演示观众，恢复后不突破身份容量', () => {
    const s = new GameSession(); const mock = new MockAdapter(s);
    mock.start(event => s.receive(event)); s.tick(); s.start();
    ticks(s, 150); mock.stop();
    const pool = stressIdentities(s.viewers.values(), true);
    expect(pool).toHaveLength(200); expect(new Set(pool.map(v => v.id)).size).toBe(200);
    for (const viewer of pool) send(s, viewer.id, '助威', viewer.name);
    expect(s.viewers.size).toBe(200);
    const nextPool = stressIdentities(s.viewers.values(), true);
    expect(new Set(nextPool.map(v => v.id)).size).toBe(200);
    mock.start(event => s.receive(event));
    for (let i = 0; i < 600; i++) { mock.update(); s.tick(); }
    expect(s.gateway.stats.overflow).toBe(0);
    expect(s.viewers.get('support-17')?.cheers).toBeGreaterThan(1);
  });
  it('演示完整走完六波、两次投票、雷暴和结算', () => {
    const s = new GameSession(); const mock = new MockAdapter(s);
    mock.start(event => s.receive(event)); s.tick(); expect(s.start()).toBe(true);
    for (let i = 0; i < 5700 && !s.result; i++) { mock.update(); s.tick(); }
    console.log('DEMO', JSON.stringify({ result: s.result, hp: s.gateHp, kills: s.kills, time: s.seconds, thunder: s.thunderCount, remaining: s.enemies.map(e => ({ kind: e.kind, lane: e.lane, hp: Math.round(e.hp), x: Math.round(e.x) })) }));
    expect(s.phase).toBe('result'); expect(s.wave).toBe(6); expect(s.completedVotes).toBe(2); expect(s.thunderCount).toBeGreaterThan(0);
    expect(s.result?.won).toBe(true);
    mock.stop();
  });
  it('200 身份、每秒 50 条、120 秒无队列积压或容量泄漏', () => {
    const s = new GameSession(); s.phase = 'playing';
    let serial = 0;
    for (let tick = 0; tick < 3600; tick++) {
      const target = Math.floor((tick + 1) * 50 / 30);
      while (serial < target) { const id = serial++ % 200; s.receive(mockEvent(s.id, `s${id}`, `观众${id}`, '助威')); }
      s.tick();
    }
    expect(s.gateway.stats.received).toBe(6000); expect(s.gateway.stats.processed).toBe(6000);
    expect(s.gateway.stats.overflow).toBe(0); expect(s.gateway.queue).toHaveLength(0);
    expect(s.viewers.size).toBe(200); expect(s.logs.length).toBeLessThanOrEqual(50); expect(s.effects.length).toBeLessThanOrEqual(200);
  });
  it('重建十局没有旧事件或旧适配器影响', () => {
    let old = new GameSession(); let calls = 0;
    for (let i = 0; i < 10; i++) {
      const mock = new MockAdapter(old); mock.start(() => calls++); mock.stop();
      const before = calls; old.phase = 'playing'; mock.update(); expect(calls).toBe(before);
      const next = new GameSession(); const event = mockEvent(old.id, 'p', 'p', '加入 火炮');
      expect(next.receive(event)).toBe(false); expect(next.gateway.queue).toHaveLength(0); expect(next.towers).toHaveLength(0); expect(next.upgrades).toHaveLength(0);
      old = next;
    }
  });
  it.each([1, 3, 6, 12])('%i 炮塔在无人助威情况下也会正常结束', count => {
    const s = new GameSession();
    for (let i = 0; i < count; i++) send(s, `p${i}`, `加入 ${['火炮', '冰塔', '雷塔'][i % 3]}`);
    s.start();
    ticks(s, (RULES.countdown + RULES.duration + 2) * RULES.tickRate);
    console.log('BALANCE', count, JSON.stringify({ result: s.result, hp: s.gateHp, kills: s.kills, time: s.seconds, remaining: s.enemies.map(e => ({kind: e.kind, lane: e.lane, hp: Math.ceil(e.hp), x: Math.round(e.x)})) }));
    expect(s.result).not.toBeNull(); expect(s.enemies.length).toBeLessThanOrEqual(120);
    if (count === 12) expect(s.result?.won).toBe(true);
  });
});
