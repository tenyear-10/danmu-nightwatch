import Phaser from 'phaser';
import { LANE_Y, LANES, RULES, SLOT_X, TOWERS } from '../config/balance';
import type { GameSession } from '../core/GameSession';
import type { Enemy, TowerKind } from '../core/types';

export interface SceneBridge {
  session: () => GameSession;
  advance: (delta: number) => void;
  focus: () => string;
}

export class BattleScene extends Phaser.Scene {
  private ink!: Phaser.GameObjects.Graphics;
  private labels = new Map<string, Phaser.GameObjects.Text>();
  private activeLabels = new Set<string>();
  private lastSession = '';
  private lastEffect = 0;
  private reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  constructor(private bridge: SceneBridge) { super('Battle'); }

  create() {
    this.drawBackdrop();
    this.ink = this.add.graphics().setDepth(2);
    this.cameras.main.setBackgroundColor('#10242a');
  }

  private label(key: string, x: number, y: number, text: string, color = '#a3b9b7', size = 12, center = true) {
    this.activeLabels.add(key);
    let object = this.labels.get(key);
    if (!object) {
      object = this.add.text(x, y, text, { fontFamily: '"Microsoft YaHei", sans-serif', fontSize: size, color, stroke: '#102027', strokeThickness: 3 }).setOrigin(center ? 0.5 : 0, 0.5).setDepth(3);
      this.labels.set(key, object);
    }
    object.setPosition(x, y).setText(text).setColor(color).setAlpha(1);
    return object;
  }

  private drawBackdrop() {
    const g = this.add.graphics();
    g.fillGradientStyle(0x0d1e27, 0x122b32, 0x193a39, 0x132c31, 1);
    g.fillRect(0, 0, 1280, 720);
    // Distant moon, fine stars and a layered industrial silhouette.
    g.fillStyle(0x9fd8c5, 0.025); g.fillCircle(1010, 95, 100);
    g.fillStyle(0xc7e5cf, 0.08); g.fillCircle(1010, 95, 60);
    g.fillStyle(0xc7e5cf, 0.64); g.fillCircle(1010, 95, 27);
    g.fillStyle(0x10262e); g.fillCircle(999, 87, 24);
    for (let i = 0; i < 85; i++) {
      const x = (i * 157 + 51) % 1280, y = (i * 37 + 13) % 170;
      g.fillStyle(0xb0d5c7, 0.15 + (i % 3) * 0.08); g.fillCircle(x, y, i % 5 === 0 ? 1.5 : 0.8);
    }
    for (let i = 0; i < 38; i++) {
      const x = i * 37 - 5, height = 25 + (i * 19) % 77;
      g.fillStyle(i % 2 ? 0x152d33 : 0x11272e); g.fillRect(x, 155 - height, 30, height);
      g.fillTriangle(x - 2, 155 - height, x + 15, 140 - height, x + 32, 155 - height);
      g.fillStyle(0xf2c777, 0.13);
      for (let j = 0; j < 3; j++) if ((i + j) % 3) g.fillRect(x + 7 + j * 7, 165 - height, 3, 5);
    }
    g.lineStyle(1, 0x4a6864, 0.3); g.lineBetween(0, 157, 1280, 157);
    for (let lane = 0; lane < 3; lane++) {
      const y = LANE_Y[lane];
      g.fillStyle(0x0a171e, 0.28); g.fillRoundedRect(217, y - 67, 1050, 132, 12);
      g.fillStyle(0x233b3b, 0.55); g.fillRect(240, y + 1, 1040, 22);
      g.lineStyle(1, 0x788a77, 0.17); g.lineBetween(243, y, 1280, y); g.lineBetween(243, y + 25, 1280, y + 25);
      for (let i = 0; i < 31; i++) {
        g.lineStyle(1, 0x75857a, 0.12); g.lineBetween(250 + i * 35, y + 2, 266 + i * 35, y + 20);
      }
      g.fillStyle(0x182f34); g.fillRoundedRect(295, y - 63, 260, 53, 9);
      g.lineStyle(1, 0x9ac9ae, 0.15); g.strokeRoundedRect(295, y - 63, 260, 53, 9);
      for (let slot = 0; slot < 4; slot++) {
        const x = SLOT_X[slot];
        g.lineStyle(1, 0x91b8a5, 0.18); g.strokeEllipse(x, y - 24, 40, 14);
        g.lineBetween(x - 4, y - 31, x + 4, y - 31); g.lineBetween(x, y - 35, x, y - 27);
      }
      this.add.text(245, y - 51, `0${lane + 1}`, { fontFamily: 'monospace', fontSize: 12, color: '#668d88' });
      this.add.text(248, y + 40, `${LANES[lane]}防线`, { fontSize: 12, color: '#5b817a' });
      // Lamps along the distant approach.
      for (let i = 0; i < 4; i++) {
        const x = 630 + i * 173;
        g.lineStyle(2, 0x36554f, 0.7); g.lineBetween(x, y - 35, x, y - 10);
        g.fillStyle(0xefbe71, 0.045); g.fillCircle(x, y - 40, 20);
        g.fillStyle(0xefbe71, 0.6); g.fillRect(x - 2, y - 44, 4, 7);
      }
    }
    // A city wall with three copper gates.
    g.fillStyle(0x0a171e); g.fillRect(0, 170, 214, 540);
    g.fillStyle(0x263b3b); g.fillRect(145, 151, 66, 560);
    g.fillStyle(0x344947); g.fillRect(145, 151, 11, 560);
    for (let y = 153; y < 710; y += 25) {
      g.lineStyle(1, 0x617167, 0.25); g.lineBetween(146, y, 210, y);
      g.lineBetween(y % 50 === 3 ? 165 : 185, y, y % 50 === 3 ? 165 : 185, y + 25);
    }
    for (const y of LANE_Y) {
      g.fillStyle(0x0b1b20); g.fillRoundedRect(163, y - 70, 53, 118, { tl: 25, tr: 25, bl: 0, br: 0 });
      g.lineStyle(2, 0x967852, 0.65); g.strokeRoundedRect(163, y - 70, 53, 118, { tl: 25, tr: 25, bl: 0, br: 0 });
      for (let x = 169; x <= 208; x += 9) { g.lineStyle(3, 0x765e40); g.lineBetween(x, y - 44, x, y + 42); }
      g.fillStyle(0xf4b66a, 0.06); g.fillEllipse(190, y - 10, 85, 120);
      g.fillStyle(0xf4b66a); g.fillCircle(188, y - 10, 3);
    }
    for (let i = 0; i < 9; i++) { g.fillStyle(0x304b47); g.fillRect(142 + (i % 3) * 26, 136 + Math.floor(i / 3) * 177, 16, 24); }
    for (let i = 0; i < 8; i++) {
      const x = 12 + (i % 3) * 42, y = 203 + Math.floor(i / 3) * 150;
      g.fillStyle(0x1c3032); g.fillRect(x, y, 31, 91);
      g.fillStyle(0x3d4b40); g.fillTriangle(x - 6, y, x + 16, y - 36, x + 36, y);
      g.fillStyle(0xe0ad69, 0.5); g.fillRect(x + 12, y + 16, 7, 12);
    }
    this.add.text(28, 46, 'NIGHTWATCH', { fontSize: 13, fontFamily: 'monospace', color: '#86ab9c', letterSpacing: 4 });
    this.add.text(28, 71, '最后一座城，等你守护。', { fontSize: 15, color: '#b5cbb9' });
    this.add.text(32, 673, '守 夜 城', { fontSize: 18, color: '#9eb59d', letterSpacing: 6 });
    this.add.text(1247, 680, '怪物从右侧进入  ←', { fontSize: 12, color: '#6a8d82' }).setOrigin(1, 0);
  }

  update(_time: number, delta: number) {
    this.bridge.advance(delta);
    const s = this.bridge.session();
    if (this.lastSession !== s.id) { for (const text of this.labels.values()) text.destroy(); this.labels.clear(); this.lastSession = s.id; this.lastEffect = 0; }
    const g = this.ink;
    g.clear();
    this.activeLabels.clear();
    // Small moving lights add life without covering any gameplay information.
    if (!this.reducedMotion) for (let i = 0; i < 14; i++) {
      const x = 255 + (i * 79 + s.clock * 0.18) % 990;
      const y = 193 + (i * 113) % 445 + Math.sin(s.clock / 60 + i) * 9;
      g.fillStyle(0xd8cf8d, 0.12 + Math.sin(s.clock / 25 + i) * 0.08); g.fillCircle(x, y, 1.5);
    }
    for (let lane = 0; lane < 3; lane++) {
      const count = s.towers.filter(t => t.lane === lane).length;
      this.label(`lane-${lane}`, 502, LANE_Y[lane] + 40, `${count} / 4 炮位`, '#6d9285', 11);
      const threats = s.enemies.filter(enemy => enemy.lane === lane);
      const urgent = threats.some(enemy => enemy.x < 490);
      this.label(`threat-${lane}`, 1128, LANE_Y[lane] + 41, urgent ? `急需支援 · ${threats.length} 敌军` : `${threats.length} 敌军接近`, urgent ? '#f2a18d' : '#7eaaa0', 12);
      if (urgent) {
        g.fillStyle(0xee8275, 0.035); g.fillRoundedRect(217, LANE_Y[lane] - 67, 1050, 132, 12);
      }
    }
    for (const tower of s.towers) {
      const x = SLOT_X[tower.slot], y = LANE_Y[tower.lane] - 37;
      const spec = TOWERS[tower.kind];
      const selected = tower.id === this.bridge.focus();
      if (selected) {
        g.fillStyle(spec.color, 0.035); g.fillRoundedRect(Math.max(RULES.gateX, x - spec.range), LANE_Y[tower.lane] - 5, Math.min(1265, x + spec.range) - Math.max(RULES.gateX, x - spec.range), 18, 5);
        g.lineStyle(2, spec.color, 0.75); g.strokeEllipse(x, y + 14, 47, 19);
        this.label(`selected-${tower.id}`, x, y + 63, '你的炮塔', '#f2d397', 11);
      }
      if (s.clock - tower.joined < 60) { g.fillStyle(spec.color, 0.15 * (1 - (s.clock - tower.joined) / 60)); g.fillCircle(x, y, 42); }
      this.drawTower(x, y, tower.kind, Math.max(0, 1 - (s.clock - tower.lastAttack) / 7));
      const name = s.viewers.get(tower.id)?.name ?? '';
      const shortName = Array.from(name).length > 8 ? Array.from(name).slice(0, 7).join('') + '…' : name;
      const nameRow = [1, 0, 0, 1][tower.slot];
      this.label(`tower-${tower.id}`, x, y - 46 - nameRow * 14, shortName, selected ? '#f4d6a3' : '#b4c5bc', 10);
    }
    for (const enemy of s.enemies) this.drawEnemy(enemy, s.clock);
    for (const effect of s.effects) {
      const age = s.clock - effect.tick;
      const alpha = Math.max(0, 1 - age / 18);
      if (effect.id > this.lastEffect) {
        this.lastEffect = effect.id;
        if (!this.reducedMotion && !s.paused && s.phase === 'playing') {
          if (effect.type === 'thunder') this.cameras.main.shake(180, 0.002);
          else if (effect.type === 'gate') this.cameras.main.shake(120, 0.0015);
        }
      }
      if (effect.type === 'shot' && age < 10) {
        const shotAlpha = 1 - age / 10;
        const endX = effect.toX ?? effect.x;
        g.lineStyle(1, effect.color, shotAlpha * 0.25);
        g.lineBetween(effect.x, effect.y, endX, effect.y + 27);
        if (effect.color === TOWERS.tesla.color) {
          g.lineStyle(5, effect.color, shotAlpha * 0.2);
          g.lineBetween(effect.x, effect.y, endX, effect.y + 27);
          g.lineStyle(2, 0xe5d9ff, shotAlpha);
          g.beginPath(); g.moveTo(effect.x, effect.y);
          for (let i = 1; i <= 9; i++) g.lineTo(effect.x + (endX - effect.x) * i / 9, effect.y + 27 * i / 9 + (i === 9 ? 0 : i % 2 ? -9 : 9));
          g.strokePath();
        } else if (effect.color === TOWERS.ice.color) {
          g.lineStyle(2, effect.color, shotAlpha);
          for (let i = 0; i < 6; i++) {
            const a = i * Math.PI / 3;
            g.lineBetween(endX, effect.y + 27, endX + Math.cos(a) * (8 + age), effect.y + 27 + Math.sin(a) * (8 + age));
          }
          g.fillStyle(effect.color, shotAlpha * 0.13); g.fillCircle(endX, effect.y + 27, 16 + age);
          g.lineStyle(3, 0xb8f4f5, shotAlpha * 0.55); g.lineBetween(effect.x, effect.y, endX, effect.y + 27);
        } else {
          g.lineStyle(4, 0xffd793, shotAlpha * 0.8); g.lineBetween(effect.x + 12, effect.y, endX, effect.y + 27);
          g.fillStyle(0xffdc99, shotAlpha); g.fillTriangle(effect.x + 13, effect.y - 7, effect.x + 43 - age * 2, effect.y, effect.x + 13, effect.y + 7);
          g.fillStyle(0xffd48c, shotAlpha * 0.3); g.fillCircle(endX, effect.y + 27, 9 + age * 1.6);
        }
        g.fillStyle(0xfff3d6, shotAlpha); g.fillCircle(endX, effect.y + 27, Math.max(1, 5 - age / 2));
      } else if (effect.type === 'hit' && age < 24) {
        this.label(`damage-${effect.id}`, effect.x + (effect.id % 3 - 1) * 12, effect.y - age * 0.9, effect.label ?? '', '#' + effect.color.toString(16).padStart(6, '0'), 15).setAlpha(Math.min(1, (24 - age) / 10));
      } else if (effect.type === 'kill' || effect.type === 'join') {
        g.lineStyle(2, effect.color, alpha); g.strokeCircle(effect.x, effect.y, 5 + age * 1.6);
        for (let j = 0; j < 8; j++) { const a = j * Math.PI / 4; g.fillStyle(effect.color, alpha); g.fillRect(effect.x + Math.cos(a) * age * 1.7, effect.y + Math.sin(a) * age * 1.5 + age * age * 0.035, 3, 3); }
      } else if (effect.type === 'thunder') {
        g.fillStyle(0x9c9aff, alpha * 0.13); g.fillRect(214, 164, 1066, 540);
        for (let j = 0; j < 6; j++) {
          const x = 400 + j * 151;
          g.lineStyle(3, 0xd0c8ff, alpha); g.beginPath(); g.moveTo(x, 180); g.lineTo(x - 40, 310); g.lineTo(x + 10, 298); g.lineTo(x - 50, 490); g.strokePath();
        }
      } else if (effect.type === 'gate') { g.fillStyle(effect.color, alpha * 0.3); g.fillRect(145, 160, 72, 550); }
      if (effect.label && (effect.type === 'wave' || effect.type === 'upgrade')) {
        const opacity = Math.min(1, (90 - age) / 12, (age + 1) / 5);
        g.fillStyle(0x09171f, opacity * 0.92); g.fillRoundedRect(486, effect.y - 23, 540, 49, 7);
        g.lineStyle(1, effect.color, opacity * 0.65); g.strokeRoundedRect(486, effect.y - 23, 540, 49, 7);
        this.label(`effect-${effect.id}`, 756, effect.y, effect.label, '#ebd8b1', 21).setAlpha(opacity);
      }
    }
    const boss = s.enemies.find(e => e.kind === 'boss');
    if (boss) {
      g.fillStyle(0x0b141d, 0.9); g.fillRoundedRect(492, 56, 450, 40, 5);
      g.fillStyle(0x422e38); g.fillRect(508, 84, 420, 4);
      g.fillStyle(0xe58b83); g.fillRect(508, 84, 420 * boss.hp / boss.maxHp, 4);
      const phase = (s.clock - boss.born) % (10 * RULES.tickRate);
      this.label('boss-title', 718, 70, `蚀夜巨像  ·  ${Math.ceil(boss.hp)} / ${Math.ceil(boss.maxHp)}`, '#f1b1a1', 13);
      this.label('boss-rage', boss.x, LANE_Y[boss.lane] - 130, phase < 60 ? '暴走中 · 加速 50%' : phase > 240 ? '即将暴走' : '优先支援中路', phase < 60 ? '#ffc7a6' : '#d2aca5', 13);
    }
    if (s.gateHp <= 30 && s.phase === 'playing') {
      g.lineStyle(4, 0xee8275, 0.3 + Math.sin(s.clock / 10) * 0.2); g.strokeRect(2, 2, 1276, 716);
      this.label('danger', 1030, 137, '⚠ 城门危急', '#f28d7c', 17);
    }
    for (const [key, text] of this.labels) if (!this.activeLabels.has(key)) { text.destroy(); this.labels.delete(key); }
  }

  private drawTower(x: number, y: number, kind: TowerKind, recoil: number) {
    const g = this.ink, color = TOWERS[kind].color;
    g.fillStyle(0x000000, 0.25); g.fillEllipse(x + 3, y + 17, 36, 12);
    g.fillStyle(0x334441); g.fillRoundedRect(x - 16, y + 3, 32, 14, 4);
    g.lineStyle(1, color, 0.55); g.strokeRoundedRect(x - 16, y + 3, 32, 14, 4);
    g.fillStyle(0x182c31); g.fillCircle(x, y, 16);
    g.lineStyle(2, color, 0.85); g.strokeCircle(x, y, 14);
    if (recoil > 0) { g.fillStyle(color, recoil * 0.17); g.fillCircle(x, y, 26 + recoil * 9); }
    if (kind === 'cannon') {
      g.fillStyle(0x7a6951); g.fillRoundedRect(x - 8, y - 10, 19, 20, 4);
      g.fillStyle(color); g.fillRect(x + 3 - recoil * 6, y - 5, 25, 10);
      g.fillStyle(0x403d36); g.fillRect(x + 23 - recoil * 6, y - 7, 7, 14);
      g.fillStyle(0xfbe0a3); g.fillCircle(x - 2, y - 2, 4);
    } else if (kind === 'ice') {
      g.fillStyle(color, 0.11); g.fillCircle(x, y - 10, 26);
      g.fillStyle(color); g.fillTriangle(x, y - 31, x - 11, y - 8, x, y + 3);
      g.fillStyle(0x4d9aaf); g.fillTriangle(x, y - 31, x + 11, y - 8, x, y + 3);
      g.lineStyle(1, 0xc0f4fa); g.lineBetween(x, y - 31, x, y + 3);
    } else {
      g.fillStyle(0x786393); g.fillRect(x - 5, y - 28, 10, 30);
      g.lineStyle(3, color); for (let i = 0; i < 3; i++) g.strokeEllipse(x, y - 6 - i * 7, 22 - i * 3, 7);
      g.fillStyle(color, 0.12); g.fillCircle(x, y - 31, 17);
      g.fillStyle(0xe6d7ff); g.fillCircle(x, y - 31, 5);
    }
  }

  private drawEnemy(enemy: Enemy, clock: number) {
    const g = this.ink, boss = enemy.kind === 'boss';
    const x = enemy.x, y = LANE_Y[enemy.lane] - (boss ? 24 : 16) + Math.sin(clock / 6 + enemy.id) * (boss ? 1 : 2);
    const size = boss ? 43 : enemy.kind === 'armor' ? 20 : 15;
    const slowed = enemy.slowUntil > clock;
    const hit = enemy.lastHit !== undefined && clock - enemy.lastHit < 3;
    const rage = boss && (clock - enemy.born) % (10 * RULES.tickRate) < 60;
    const color = hit ? 0xf4edce : slowed ? 0x70becb : boss ? 0x695474 : enemy.kind === 'armor' ? 0x8d9285 : enemy.kind === 'fast' ? 0xc69a69 : 0x8ba891;
    if (boss) {
      g.fillStyle(0xef9384, rage ? 0.13 : 0.05); g.fillEllipse(x, y + 35, 126, 40);
      g.lineStyle(2, 0xf6a795, rage ? 0.5 : 0.18); g.strokeEllipse(x, y + 35, 110, 32);
    }
    if (enemy.kind === 'fast') for (let i = 1; i < 4; i++) { g.lineStyle(2, 0xd9a275, 0.35 / i); g.lineBetween(x + 18 + i * 9, y - 8 + i * 5, x + 29 + i * 9, y - 8 + i * 5); }
    g.fillStyle(0x050f17, 0.45); g.fillEllipse(x, y + size * 0.8, size * 2.5, size * 0.6);
    g.fillStyle(color); g.fillRoundedRect(x - size, y - size, size * 2, size * 1.8, boss ? 5 : 7);
    g.fillTriangle(x - size, y - size + 2, x - size * 0.9, y - size * 1.65, x - size * 0.3, y - size);
    g.fillTriangle(x + size, y - size + 2, x + size * 0.9, y - size * 1.65, x + size * 0.3, y - size);
    g.fillStyle(0x14282a); g.fillRoundedRect(x - size * 0.75, y - size * 0.5, size * 1.5, size * 0.8, 3);
    g.fillStyle(boss ? 0xffa38b : 0xd5e7a7); g.fillRect(x - size * 0.65, y - 4, size * 0.45, 3); g.fillRect(x + size * 0.1, y - 4, size * 0.45, 3);
    g.lineStyle(3, color); g.lineBetween(x - size / 2, y + size / 2, x - size / 2 - 3, y + size); g.lineBetween(x + size / 2, y + size / 2, x + size / 2 + 3, y + size);
    if (enemy.kind === 'armor' || boss) { g.lineStyle(2, boss ? 0xb68eaa : 0xb4a896); g.strokeRoundedRect(x - size, y - size, size * 2, size * 1.8, 4); }
    if (enemy.kind === 'armor') {
      g.fillStyle(0x3b5555); g.fillRoundedRect(x - 27, y - 9, 15, 31, 3);
      g.lineStyle(2, 0xafba9b); g.strokeRoundedRect(x - 27, y - 9, 15, 31, 3);
      g.fillStyle(0xd6bf83); g.fillRect(x - 21, y - 4, 3, 20);
    }
    if (boss) {
      g.fillStyle(0x4e4f62); g.fillRoundedRect(x - 57, y - 17, 23, 49, 5); g.fillRoundedRect(x + 34, y - 17, 23, 49, 5);
      g.lineStyle(2, 0xb792a5); g.strokeRoundedRect(x - 57, y - 17, 23, 49, 5); g.strokeRoundedRect(x + 34, y - 17, 23, 49, 5);
      g.fillStyle(0xf89d80, 0.16); g.fillCircle(x, y + 17, 20);
      g.fillStyle(rage ? 0xffd8a9 : 0xe99585); g.fillCircle(x, y + 17, 8);
      g.fillStyle(0xffe0bc); g.fillCircle(x, y + 17, 3);
    }
    if (slowed) {
      g.lineStyle(1, 0x91e4ed, 0.5); g.strokeEllipse(x, y + size, size * 2.7, 10);
      for (let i = 0; i < 3; i++) { g.fillStyle(0x96e3ef, 0.5); g.fillTriangle(x - size + i * size, y + size, x - size - 3 + i * size, y + size - 9, x - size + 3 + i * size, y + size - 9); }
    }
    const width = boss ? 102 : 35;
    g.fillStyle(0x0b171a); g.fillRect(x - width / 2, y - size * 1.8 - 7, width, 4);
    g.fillStyle(slowed ? 0x81dce8 : boss ? 0xe49a95 : 0xa8c59d); g.fillRect(x - width / 2, y - size * 1.8 - 7, width * enemy.hp / enemy.maxHp, 4);
  }
}
