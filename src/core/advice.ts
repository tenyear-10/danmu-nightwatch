import { LANES, RULES } from '../config/balance';
import type { GameSession } from './GameSession';

export function battleAdvice(s: GameSession, viewerId: string) {
  const tower = s.towers.find(item => item.id === viewerId);
  const boss = s.enemies.find(enemy => enemy.kind === 'boss');
  if (s.result) {
    if (s.result.won) return { title: '黎明已至', detail: '这座城记住了每一位守夜人的名字。', tone: 'good' };
    if (boss) return { title: '下次试试集中火力', detail: 'Boss 出现后，将火炮换到中路；冰塔负责减速，别让中路只有辅助炮塔。', tone: 'warn' };
    return { title: '下次试试分兵守路', detail: '留意有敌军却无人防守的路线；助威蓄满后的雷暴可以同时清理三路。', tone: 'warn' };
  }
  if (s.paused) return { title: '守城已暂停', detail: '倒计时与技能冷却都已停住，点击继续即可恢复。', tone: 'info' };
  if (s.phase === 'lobby') return { title: tower ? '你的炮塔已就位' : '先成为一名守夜人', detail: tower ? '可以先调整路线。准备好后点击开始，炮塔会自动攻击。' : '在右侧选择火炮、冰塔或雷塔，你的昵称就会出现在战场上。', tone: 'info' };
  if (s.phase === 'countdown') return { title: '即将迎敌', detail: '炮塔自动攻击。你只需关注换防、助威和升级投票。', tone: 'info' };
  if (s.vote) return { title: '全城升级投票中', detail: '发送 1 增伤、2 修复城门、3 提升攻速；截止前可以改票。', tone: 'good' };
  if (boss) return { title: 'Boss 现身中路', detail: s.towers.some(t => t.lane === 1 && t.kind === 'cannon') ? '中路已有火炮。继续助威，击败 Boss 后别忘记清理其他路线。' : '中路缺少火炮！将单体输出换到中路，争取在黎明前击败巨像。', tone: 'warn' };
  const nearest = s.enemies.reduce<(typeof s.enemies)[number] | undefined>((best, enemy) => !best || enemy.x < best.x ? enemy : best, undefined);
  if (nearest && nearest.x < RULES.gateX + 290) return { title: `${LANES[nearest.lane]}急需支援`, detail: `敌军已经接近城门，发送「${LANES[nearest.lane]}」换防，或助威触发全体雷暴。`, tone: 'warn' };
  if (!tower) return { title: '你也可以亲自加入', detail: '点击一种炮塔参与战斗，或用助威为全队积攒能量。', tone: 'info' };
  if (s.energy === RULES.energyMax && !s.enemies.length) return { title: '雷暴已经蓄满', detail: '能量会保留到敌军出现，不会在空场浪费。', tone: 'good' };
  return { title: `第 ${s.wave} 波 · 守住三条防线`, detail: '高亮区域是你的炮塔射程。留意路线下方的敌军数量，随时调整防守。', tone: 'info' };
}
