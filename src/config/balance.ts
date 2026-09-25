export const RULES = {
  tickRate: 30,
  duration: 180,
  countdown: 5,
  gateHp: 100,
  gateX: 200,
  spawnX: 1190,
  openingSpawnX: 1010,
  finalWaveSpawnX: 990,
  bossSpawnX: 870,
  maxTowers: 12,
  laneCapacity: 4,
  maxEnemies: 120,
  maxViewers: 200,
  queueCapacity: 500,
  perTick: 20,
  ratePerSecond: 5,
  dedupCapacity: 10000,
  moveCooldown: 5,
  cheerCooldown: 3,
  energyMax: 30,
  thunderDamage: 35,
  thunderCooldown: 5,
  voteDuration: 8,
} as const;

export const LANES = ['上路', '中路', '下路'] as const;
export const LANE_Y = [242, 418, 594];
export const SLOT_X = [410, 462, 358, 514];
export const WAVES = [6, 9, 12, 15, 18, 12];
export const WAVE_NAMES = ['初夜试探', '暗流涌动', '疾影来袭', '长夜围城', '铁甲压境', '蚀夜巨像'];
export const TOWERS = {
  cannon: { name: '火炮', damage: 16, interval: 1, range: 450, color: 0xf4b66a, css: '#f4b66a' },
  ice: { name: '冰塔', damage: 5, interval: 1.2, range: 450, color: 0x80deea, css: '#80deea' },
  tesla: { name: '雷塔', damage: 6, interval: 1.5, range: 450, color: 0xba9bff, css: '#ba9bff' },
} as const;
export const ENEMIES = {
  normal: { name: '游荡者', hp: 45, speed: 24, gateDamage: 4 },
  fast: { name: '疾行兽', hp: 25, speed: 42, gateDamage: 3 },
  armor: { name: '铁甲卫', hp: 110, speed: 20, gateDamage: 10 },
  boss: { name: '蚀夜巨像', hp: 450, speed: 10, gateDamage: 100 },
} as const;
export const UPGRADES = ['全队伤害 +15%', '城门恢复 20', '攻击间隔 −10%'];
