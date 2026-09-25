import Phaser from 'phaser';
import { RULES, TOWERS, WAVE_NAMES } from './config/balance';
import { GameSession } from './core/GameSession';
import { battleAdvice } from './core/advice';
import type { Mode } from './core/types';
import { MockAdapter, mockEvent } from './input/MockAdapter';
import { parseCommand } from './input/commands';
import { stressIdentities } from './input/stress';
import { BattleScene } from './scenes/BattleScene';
import { GameAudio } from './audio';
import './style.css';
import './polish.css';
import './visual-theme.css';

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <header class="masthead">
    <a class="brand" href="./" aria-label="弹幕守夜城首页"><span class="brand-mark">夜</span><span>守夜城 <small>NIGHTWATCH</small></span></a>
    <div class="header-center"><span class="status-dot"></span> 雾港守备所 <span class="divider">/</span> 第六夜</div>
    <div class="header-actions"><span class="sim-badge">本地模拟 · 未接直播</span><button id="sound" class="quiet-button" aria-label="开启音效">音效：关</button><button id="help" class="quiet-button">玩法</button></div>
  </header>
  <main>
    <section class="page-heading"><div><div class="eyebrow">雾港防卫档案　/　001</div><h1>弹幕守夜城<span>守住城门，等到天亮。</span></h1></div><div class="chapter"><span>守夜任务</span><strong>三条防线 · 六波敌袭 · 三分钟</strong></div></section>
    <section class="dashboard" aria-label="战况">
      <div class="stat gate-stat"><span class="stat-icon">♜</span><div><label>城门耐久</label><strong><span id="hp">100</span><small> / 100</small></strong><div class="meter"><i id="hp-bar"></i></div></div></div>
      <div class="stat"><span class="stat-icon muted-icon">◷</span><div><label>距离黎明</label><strong id="timer">03:00</strong></div><span id="phase" class="stat-note">等待部署</span></div>
      <div class="stat"><span class="stat-icon muted-icon">≋</span><div><label>进攻波次</label><strong><span id="wave">0</span><small> / 6</small></strong></div><span class="stat-note">末波首领</span></div>
      <div class="stat energy-stat"><span class="stat-icon purple">ϟ</span><div><label>全体雷暴 <span id="energy-label">0 / 30</span></label><div class="meter"><i id="energy-bar"></i></div><small id="energy-hint">发送「助威」积攒能量</small></div></div>
    </section>
    <section class="battle-progress" aria-label="六波守城进度"><ol>${WAVE_NAMES.map((name, i) => `<li id="wave-step-${i}"><span>0${i + 1}</span><b>${name}</b></li>`).join('')}</ol><span id="wave-next">准备迎接第一波</span></section>
    <div class="workspace">
      <section class="arena-card">
        <div class="arena-toolbar"><div><span class="arena-coordinate">01 / 雾港</span><b>城墙防线</b><span class="arena-tag">三路共守</span></div><div class="arena-tools"><button id="speed" title="切换演示速度">1× 速度</button><button id="pause">暂停</button><button id="restart">重开</button><button id="fullscreen" aria-label="全屏战场">⛶</button></div></div>
        <div class="game-shell" id="game-shell">
          <div id="game" role="img" aria-label="守夜城三路塔防战场"></div>
          <div id="loading">正在点亮守夜城…</div>
          <div id="lobby" class="center-overlay"><div class="intro-panel"><span class="intro-kicker">雾港守城令 · 第 001 号</span><h2>今夜，守住<br>这座城。</h2><p>敌军将从右侧逼近。部署炮塔，指挥换防；<br>撑过六波进攻，迎接黎明。</p><div class="intro-actions"><button id="start-demo" class="primary">开始守夜 <span>→</span></button><button id="manual" class="secondary">手动部署</button></div><span class="intro-foot">约三分钟一局 · 所有弹幕均为本地模拟</span></div></div>
          <div id="countdown" class="countdown-overlay" hidden><span>守夜人，请就位</span><strong id="countdown-number">5</strong></div>
          <div id="paused-overlay" class="pause-overlay" hidden><strong>守夜暂停</strong><span>休息一下，城门还在。</span><button id="resume" class="primary">继续守夜 →</button></div>
          <div id="result" class="center-overlay" hidden><div class="result-panel"><div id="result-kicker" class="eyebrow">本夜战报</div><h2 id="result-title">守住了！</h2><p id="result-reason"></p><div class="result-numbers"><div><strong id="result-kills">0</strong><span>消灭敌人</span></div><div><strong id="result-time">0</strong><span>守护秒数</span></div><div><strong id="result-cheers">0</strong><span>全体助威</span></div></div><div id="result-ranks" class="result-ranks"></div><p id="result-tip" class="result-tip"></p><button id="play-again" class="primary">再守一夜 →</button></div></div>
          <div id="vote" class="vote-panel" hidden><div><span class="eyebrow">全城议事 · 升级投票</span><b id="vote-time">8 秒</b></div><p>你的选择，会改变每一座炮塔。</p><div class="vote-options"><button data-command="1"><kbd>1</kbd>全队伤害 +15%<span id="vote-0">0 票</span></button><button data-command="2"><kbd>2</kbd>城门恢复 20<span id="vote-1">0 票</span></button><button data-command="3"><kbd>3</kbd>攻击间隔 −10%<span id="vote-2">0 票</span></button></div></div>
        </div>
        <div id="tactical-strip" class="tactical-strip"><span class="tactical-icon">◇</span><div><b id="advice-title">先成为一名守夜人</b><span id="advice-detail">在右侧选择炮塔，你的昵称就会出现在战场上。</span></div></div>
        <div class="command-guide"><span><kbd>召唤火炮</kbd> 部署炮塔</span><span><kbd>上路 / 中路 / 下路</kbd> 换防</span><span><kbd>助威</kbd> 积攒能量</span><span><kbd>1 / 2 / 3</kbd> 升级投票</span></div>
      </section>
      <aside class="control-card">
        <div class="card-heading"><div><span class="eyebrow">守夜人席位　/　01</span><h2>加入这场守城</h2></div><span class="small-tag">本地模拟</span></div>
        <p class="control-intro">选一座炮塔，再用弹幕指挥它。</p>
        <div class="identity"><label for="viewer-id">你的身份 <button id="new-viewer">＋ 换个身份</button></label><input id="viewer-id" maxlength="80" value="player-1" aria-label="观众 ID"><input id="viewer-name" maxlength="24" value="你·守夜人" aria-label="观众昵称"><span id="my-status">尚未部署炮塔</span></div>
        <div class="section-label"><span>01</span> 选择你的炮塔</div>
        <div class="tower-choices"><button data-command="加入 火炮" class="tower-choice cannon"><span class="tower-symbol" aria-hidden="true"><svg viewBox="0 0 64 64"><path d="M8 47h48M16 41l7-10h27l5 10M20 31l4-13h28v8H26M29 47v-6m18 6v-6"/><circle cx="25" cy="48" r="4"/><circle cx="47" cy="48" r="4"/></svg></span><b>火炮</b><small>单体强攻</small></button><button data-command="加入 冰塔" class="tower-choice ice"><span class="tower-symbol" aria-hidden="true"><svg viewBox="0 0 64 64"><path d="M32 7v50M10 20l44 24M54 20L10 44M32 7l-5 7m5-7 5 7m-5 43-5-7m5 7 5-7M10 20l9 1m-9-1 4 8m40-8-9 1m9-1-4 8M10 44l9-1m-9 1 4-8m40 8-9-1m9 1-4-8"/></svg></span><b>冰塔</b><small>减速控场</small></button><button data-command="加入 雷塔" class="tower-choice tesla"><span class="tower-symbol" aria-hidden="true"><svg viewBox="0 0 64 64"><path d="M8 52h48M23 52l9-36 9 36M28 35h8M32 5v7M14 18l8 5m28-5-8 5M15 35l7 1m27-1-7 1M40 10l-5 11h8l-8 15"/></svg></span><b>雷塔</b><small>群体打击</small></button></div>
        <div class="section-label"><span>02</span> 调整防线 <small id="move-hint">换防冷却 5 秒</small></div>
        <div class="lane-choices"><button data-command="上路">↗ 上路</button><button data-command="中路">→ 中路</button><button data-command="下路">↘ 下路</button></div>
        <button data-command="助威" class="cheer-button"><span>ϟ</span><div><b>为全城助威</b><small id="cheer-hint">能量 +1 · 每人每 3 秒一次</small></div><span>＋</span></button>
        <form id="chat-form"><label for="chat">或者，发送一条弹幕</label><div class="chat-input"><input id="chat" maxlength="80" autocomplete="off" placeholder="试试：召唤火炮"><button type="submit" aria-label="发送弹幕">↑</button></div></form>
        <div id="input-feedback" class="input-feedback" role="status" aria-live="polite">点击炮塔卡片即可加入，昵称会出现在战场上。</div>
        <div class="auto-control"><div><b>演示观众</b><small>自动助威、投票与末波换防</small></div><button id="auto-toggle" role="switch" aria-checked="true" aria-label="演示观众自动互动" class="switch"><i></i></button></div>
        <button id="start-manual" class="primary full" hidden>部署完毕 · 开始守城 →</button>
      </aside>
    </div>
    <div class="bottom-grid">
      <section class="feed-card"><div class="bottom-title"><h2><span class="status-dot"></span> 城中回响</h2><span id="audience">0 位参与者</span></div><div id="feed" class="feed" aria-label="最近互动记录"></div></section>
      <section class="contribution-card"><div class="bottom-title"><h2>今夜的守护者</h2><span id="tower-count">0 / 12 炮位</span></div><div id="leaders" class="leaders"></div><div class="upgrade-summary" id="upgrades">第 60 / 120 秒开启全城升级投票</div></section>
    </div>
    <details class="diagnostics"><summary>开发观测台 <span>事件队列 · 去重 · 冷却 · 压力测试</span></summary><div class="diagnostic-body"><pre id="metrics"></pre><div><button id="stress" class="secondary">运行 200 人压力测试</button><p id="stress-status">每秒 50 条模拟事件，持续 120 秒；期间暂停自动观众，避免超过身份上限。</p></div></div></details>
    <footer><span>雾港守备所 / v0.3.1</span><span>守住三条防线，等到天亮。</span><span>Phaser × TypeScript</span></footer>
  </main>
  <dialog id="help-dialog"><button id="close-help" class="dialog-close" aria-label="关闭玩法说明">×</button><div class="eyebrow">守夜手册</div><h2>一起守到天亮</h2><p>怪物从右侧逼近城门。炮塔会自动攻击，你负责部署、换防和助威。</p><ol><li><b>加入：</b>发送“召唤火炮”“召唤冰塔”“召唤雷塔”，或点选炮塔。每个观众一个炮位，全场最多 12 个。</li><li><b>换防：</b>发送上路、中路或下路，五秒冷却，满员路线不可进入。</li><li><b>助威：</b>每人三秒一次。集满 30 能量自动释放全场雷暴。</li><li><b>投票：</b>第 60、120 秒投票升级，八秒内发送 1、2、3；允许改票。</li><li><b>胜利：</b>180 秒内消灭第六波和首领，城门耐久必须大于零。</li></ol><p class="help-note">演示观众会自动互动，也会在首领出场时换防。所有输入均为本地模拟，尚未接入直播平台。切到后台会自动暂停。</p><button id="help-done" class="primary">明白了，去守城 →</button></dialog>
`;

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const text = (id: string, value: string | number) => { $(id).textContent = String(value); };
const audio = new GameAudio();
let session = new GameSession('demo');
let adapter = new MockAdapter(session);
let automatic = true;
let speed = 1;
let accumulator = 0;
let uiElapsed = 0;
let lastLog = -1;
let lastFocus = '';
let lastSound = 0;
let playerSequence = 1;
let fps = 60;
let stress: { remaining: number; serial: number; restore: boolean; identities: { id: string; name: string }[] } | null = null;

const identity = () => ({ id: $('viewer-id') as HTMLInputElement, name: $('viewer-name') as HTMLInputElement });
function feedback(message: string, warn = false) { text('input-feedback', message); $('input-feedback').classList.toggle('warning', warn); }

function reset(mode: Mode, showIntro = false) {
  adapter.stop();
  stress = null;
  session = new GameSession(mode);
  adapter = new MockAdapter(session);
  automatic = mode === 'demo';
  if (automatic) { adapter.start(event => session.receive(event)); session.tick(); }
  accumulator = 0;
  lastLog = -1;
  lastFocus = '';
  lastSound = 0;
  $('lobby').hidden = !showIntro;
  text('stress-status', '每秒 50 条模拟事件，持续 120 秒；期间暂停自动观众，避免超过身份上限。');
  text('stress', '运行 200 人压力测试');
  feedback(mode === 'demo' ? '三位演示队员已就位。你也可以选择炮塔加入。' : '手动模式：选择炮塔加入，再点击“开始守城”。');
  render();
}

function send(command: string) {
  const { id, name } = identity();
  if (!id.value.trim()) { feedback('请先填写观众 ID。', true); return; }
  if (session.paused || session.phase === 'result') { feedback(session.paused ? '游戏已暂停，继续后再发送。' : '本局已结束，再来一局即可继续。', true); return; }
  const accepted = session.receive(mockEvent(session.id, id.value.trim(), name.value.trim(), command));
  feedback(!accepted ? '发送过快或观众容量已满，请稍后重试。' : parseCommand(command) ? '指令已送达，等待战场确认。' : '普通弹幕已发送，不会触发操作。', !accepted);
}

function pause() {
  if (!['playing', 'countdown'].includes(session.phase)) return;
  session.paused = !session.paused;
  accumulator = 0;
  render();
}

function advance(delta: number) {
  const frameDelta = Math.min(delta, 100);
  fps = fps * 0.95 + 0.05 * (1000 / Math.max(1, delta));
  if (!session.paused && session.phase !== 'result') {
    if (stress) {
      stress.remaining = Math.max(0, stress.remaining - frameDelta);
      const targetCount = Math.min(6000, Math.floor((120000 - stress.remaining + 0.000001) / 20));
      while (stress.serial < targetCount) {
        const index = stress.serial++ % 200;
        const viewer = stress.identities[index];
        session.receive(mockEvent(session.id, viewer.id, viewer.name, session.vote ? String(index % 3 + 1) : '助威'));
      }
      if (stress.remaining <= 0) stopStress('已完成 120 秒压力测试');
    }
    accumulator += frameDelta * speed;
    while (accumulator >= 1000 / RULES.tickRate) {
      accumulator -= 1000 / RULES.tickRate;
      adapter.update();
      session.tick();
      if (session.result) { accumulator = 0; if (stress) stopStress('本局已结束，压力测试提前停止'); break; }
    }
  }
  for (const effect of session.effects) if (effect.id > lastSound) { audio.play(effect.type); lastSound = effect.id; }
  uiElapsed += delta;
  if (uiElapsed > 100) { render(); uiElapsed = 0; }
}

function stopStress(message: string) {
  const restore = stress?.restore;
  const sent = stress?.serial ?? 0;
  stress = null;
  if (restore) { automatic = true; adapter.start(event => session.receive(event)); }
  text('stress-status', `${message}，已注入 ${sent} 条事件。具体接收与拒绝计数见左侧。`);
  text('stress', '运行 200 人压力测试');
}

function render() {
  text('hp', session.gateHp);
  $('hp-bar').style.width = `${session.gateHp}%`;
  $('hp-bar').classList.toggle('danger', session.gateHp <= 30);
  const seconds = Math.ceil(session.remaining);
  text('timer', `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`);
  text('phase', session.paused ? '已暂停' : { lobby: '等待部署', countdown: '即将开始', playing: '守城中', result: '已结算' }[session.phase]);
  text('wave', session.wave);
  text('energy-label', `${session.energy} / ${RULES.energyMax}`);
  $('energy-bar').style.width = `${session.energy / RULES.energyMax * 100}%`;
  const thunderWait = Math.max(0, Math.ceil((session.thunderReady - session.clock) / RULES.tickRate));
  text('energy-hint', session.energy === RULES.energyMax ? (thunderWait ? `雷暴就绪 · 冷却 ${thunderWait} 秒` : '雷暴就绪 · 遇敌自动释放') : '发送「助威」积攒能量');
  text('pause', session.paused ? '继续' : '暂停');
  ($('pause') as HTMLButtonElement).disabled = !['playing', 'countdown'].includes(session.phase);
  text('speed', `${speed}× 速度`);
  $('countdown').hidden = session.phase !== 'countdown' || session.paused;
  text('countdown-number', Math.max(1, Math.ceil(session.countdown / RULES.tickRate)));
  $('paused-overlay').hidden = !session.paused;
  $('result').hidden = session.phase !== 'result';
  $('game-shell').classList.toggle('show-result', session.phase === 'result');
  $('vote').hidden = !session.vote || session.paused;
  $('start-manual').hidden = session.phase !== 'lobby' || !$('lobby').hidden;
  ($('start-manual') as HTMLButtonElement).disabled = session.towers.length === 0;
  $('auto-toggle').setAttribute('aria-checked', String(automatic));
  text('audience', `${session.viewers.size} 位参与者`);
  text('tower-count', `${session.towers.length} / 12 炮位`);
  const focusId = identity().id.value.trim();
  const myTower = session.towers.find(t => t.id === focusId);
  const viewer = session.viewers.get(focusId);
  const cheerWait = Math.max(0, Math.ceil(((viewer?.cheerReady ?? 0) - session.clock) / RULES.tickRate));
  const moveWait = Math.max(0, Math.ceil(((viewer?.moveReady ?? 0) - session.clock) / RULES.tickRate));
  const blocked = session.paused || session.phase === 'result';
  const advice = battleAdvice(session, focusId);
  text('advice-title', advice.title); text('advice-detail', advice.detail);
  $('tactical-strip').dataset.tone = advice.tone;
  text('move-hint', moveWait ? `换防冷却 ${moveWait} 秒` : '换防冷却 5 秒');
  text('cheer-hint', session.phase !== 'playing' ? '战斗开始后即可助威' : cheerWait ? `助威冷却 ${cheerWait} 秒` : session.energy === RULES.energyMax ? '能量已满 · 雷暴蓄势待发' : '能量 +1 · 每人每 3 秒一次');
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-command]')) {
    const command = button.dataset.command!;
    if (command.startsWith('加入')) {
      button.disabled = blocked || !!myTower || session.towers.length >= RULES.maxTowers;
      button.title = myTower ? '每位观众每局一个炮塔，换个身份可部署新炮塔' : '点击部署；优先分配到人数较少、职业互补的路线';
    } else if (command.endsWith('路')) {
      const lane = ['上路', '中路', '下路'].indexOf(command);
      const full = session.towers.filter(t => t.lane === lane).length >= RULES.laneCapacity;
      button.disabled = blocked || !myTower || !!moveWait || myTower.lane === lane || full;
      button.classList.toggle('selected', myTower?.lane === lane);
      button.title = full ? '此路线炮位已满' : moveWait ? `还需冷却 ${moveWait} 秒` : '将自己的炮塔换防到这条路线';
    } else if (command === '助威') button.disabled = blocked || session.phase !== 'playing' || !!cheerWait || session.energy === RULES.energyMax;
    else {
      button.disabled = blocked || !session.vote;
      const chosen = session.vote?.ballots.get(focusId) === Number(command) - 1;
      button.classList.toggle('selected', chosen);
      button.setAttribute('aria-pressed', String(chosen));
    }
  }
  for (let i = 0; i < WAVE_NAMES.length; i++) {
    const step = $(`wave-step-${i}`);
    step.classList.toggle('current', session.wave === i + 1 && session.phase !== 'result');
    step.classList.toggle('past', session.wave > i + 1 || !!session.result?.won);
    if (session.wave === i + 1) step.setAttribute('aria-current', 'step'); else step.removeAttribute('aria-current');
  }
  text('wave-next', session.phase === 'playing' ? session.wave < 6 ? `下一波 ${Math.max(0, Math.ceil(session.wave * 30 - session.seconds))} 秒` : `最后一战 · 剩余 ${session.enemies.length + session.pending.length} 敌军` : session.result ? '本次守夜已结束' : '准备迎接第一波');
  text('my-status', myTower ? `${TOWERS[myTower.kind].name} · ${['上路', '中路', '下路'][myTower.lane]} · 有效伤害 ${Math.floor(session.viewers.get(myTower.id)?.damage ?? 0)}` : '尚未部署炮塔 · 可助威与投票');
  for (const button of document.querySelectorAll<HTMLElement>('.tower-choice')) button.classList.toggle('selected', button.dataset.command === (myTower ? `加入 ${TOWERS[myTower.kind].name}` : ''));
  if (session.vote) {
    text('vote-time', `${Math.ceil((session.vote.end - session.battleTick) / RULES.tickRate)} 秒`);
    session.voteCounts.forEach((count, i) => text(`vote-${i}`, `${count} 票`));
  }
  text('upgrades', session.upgrades.length ? `全城强化：${session.upgrades.join(' · ')}` : '第 60 / 120 秒开启全城升级投票');
  const latest = session.logs.at(-1);
  if (latest && (latest.id !== lastLog || focusId !== lastFocus)) {
    lastLog = latest.id;
    lastFocus = focusId;
    const feed = $('feed'); feed.replaceChildren();
    for (const log of session.logs.slice(-4).reverse()) {
      const row = document.createElement('div'); row.className = `feed-row ${log.tone}`;
      const time = document.createElement('time'); time.textContent = `${Math.floor(log.at / 60).toString().padStart(2, '0')}:${Math.floor(log.at % 60).toString().padStart(2, '0')}`;
      const name = document.createElement('b'); name.textContent = log.name;
      const content = document.createElement('span'); content.textContent = log.text;
      row.append(time, name, content); feed.append(row);
    }
    const personal = session.logs.slice().reverse().find(log => log.viewerId === focusId);
    if (personal) feedback(personal.text, personal.tone === 'warn');
  }
  const leaders = [...session.viewers.values()].sort((a, b) => b.damage - a.damage).slice(0, 3);
  const leaderBox = $('leaders'); leaderBox.replaceChildren();
  if (!leaders.length) { const empty = document.createElement('p'); empty.className = 'empty'; empty.textContent = '第一个守夜人，会是你吗？'; leaderBox.append(empty); }
  for (const [index, viewer] of leaders.entries()) {
    const row = document.createElement('div'); row.className = 'leader-row';
    const rank = document.createElement('span'); rank.className = 'rank'; rank.textContent = `0${index + 1}`;
    const name = document.createElement('b'); name.textContent = viewer.name;
    const amount = document.createElement('span'); amount.textContent = `${Math.floor(viewer.damage)} 伤害`;
    row.append(rank, name, amount); leaderBox.append(row);
  }
  if (session.result) {
    text('result-kicker', session.result.won ? '黎明战报' : '本夜战报');
    text('result-title', session.result.won ? '天亮了，我们守住了。' : '长夜未尽，再守一次。');
    text('result-reason', session.result.reason);
    text('result-tip', session.result.won ? '' : advice.detail);
    text('result-kills', session.kills);
    text('result-time', Math.floor(session.seconds));
    text('result-cheers', [...session.viewers.values()].reduce((sum, v) => sum + v.cheers, 0));
    const box = $('result-ranks'); box.replaceChildren();
    const cheerLeaders = [...session.viewers.values()].sort((a, b) => b.cheers - a.cheers).slice(0, 3);
    for (const [title, values] of [['火力贡献', leaders.map(v => `${v.name} ${Math.floor(v.damage)}`)], ['助威贡献', cheerLeaders.map(v => `${v.name} ${v.cheers}次`)]] as const) {
      const line = document.createElement('p'); line.textContent = `${title}：${values.join(' · ') || '暂无'}`; box.append(line);
    }
  }
  const stats = session.gateway.stats;
  text('metrics', `FPS ≈ ${Math.round(fps)}  |  游戏速度 ${speed}×  |  ${session.enemies.length} 个敌人\n接收 ${stats.received}  入队 ${stats.accepted}  处理 ${stats.processed}  排队 ${session.gateway.queue.length}\n去重 ${stats.duplicate}  限流 ${stats.rateLimited}  冷却拒绝 ${stats.cooldown}\n溢出 ${stats.overflow}  无效 ${stats.invalid}  旧局 ${stats.stale}  暂停/结束 ${stats.paused}`);
  if (stress) text('stress-status', `压力测试中：已发送 ${stress.serial} 条，剩余 ${Math.ceil(stress.remaining / 1000)} 秒（前台运行时间）。`);
}

document.querySelectorAll<HTMLButtonElement>('[data-command]').forEach(button => button.addEventListener('click', () => send(button.dataset.command!)));
$('chat-form').addEventListener('submit', event => { event.preventDefault(); const input = $('chat') as HTMLInputElement; if (input.value.trim()) { send(input.value); input.value = ''; } });
$('start-demo').addEventListener('click', () => { $('lobby').hidden = true; session.start(); render(); });
$('manual').addEventListener('click', () => reset('manual'));
$('start-manual').addEventListener('click', () => { session.start(); render(); });
$('restart').addEventListener('click', () => reset(session.mode));
$('play-again').addEventListener('click', () => reset(session.mode));
$('pause').addEventListener('click', pause);
$('resume').addEventListener('click', pause);
$('speed').addEventListener('click', () => { speed = speed === 1 ? 2 : speed === 2 ? 4 : 1; render(); });
$('sound').addEventListener('click', async () => { try { await audio.toggle(); text('sound', `音效：${audio.muted ? '关' : '开'}`); $('sound').setAttribute('aria-label', audio.muted ? '开启音效' : '关闭音效'); } catch { feedback('当前浏览器无法启动音效，可以静音游玩。', true); } });
$('fullscreen').addEventListener('click', async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else await $('game-shell').requestFullscreen(); } catch { feedback('当前浏览器不支持全屏，请放大窗口游玩。'); } });
$('new-viewer').addEventListener('click', () => { playerSequence++; identity().id.value = `player-${playerSequence}`; identity().name.value = `你·守夜人${playerSequence}`; feedback('已切换身份，选择炮塔即可让新观众加入。'); render(); });
$('auto-toggle').addEventListener('click', () => {
  if (stress) { feedback('压力测试期间自动观众保持关闭。'); return; }
  automatic = !automatic;
  if (automatic) adapter.start(event => session.receive(event)); else adapter.stop();
  render();
});
$('stress').addEventListener('click', () => {
  if (stress) { stopStress('手动停止'); return; }
  if (session.phase !== 'playing' || session.paused) { feedback('请先开始战斗并保持运行，再启动压力测试。', true); return; }
  // Reuse existing identities before adding synthetic users to keep the global cap honest.
  const restore = automatic;
  adapter.stop(); automatic = false;
  const identities = stressIdentities(session.viewers.values(), restore);
  stress = { remaining: 120000, serial: 0, restore, identities };
  text('stress', '停止压力测试');
});
const helpDialog = $('help-dialog') as HTMLDialogElement;
$('help').addEventListener('click', () => { if (['playing', 'countdown'].includes(session.phase) && !session.paused) pause(); helpDialog.showModal(); });
for (const id of ['close-help', 'help-done']) $(id).addEventListener('click', () => helpDialog.close());
document.addEventListener('visibilitychange', () => { if (document.hidden && ['playing', 'countdown'].includes(session.phase) && !session.paused) pause(); });

reset('demo', true);
new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: 1280,
  height: 720,
  backgroundColor: '#10242a',
  antialias: true,
  audio: { noAudio: true },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: new BattleScene({ session: () => session, advance, focus: () => identity().id.value.trim() }),
  callbacks: { postBoot: () => { $('loading').hidden = true; } },
});
