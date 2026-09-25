export class GameAudio {
  muted = true;
  private context?: AudioContext;
  private lastShot = 0;

  async toggle() {
    this.context ??= new AudioContext();
    await this.context.resume();
    this.muted = !this.muted;
    if (!this.muted) this.play('join');
  }

  play(type: string) {
    if (this.muted || !this.context || this.context.state !== 'running') return;
    const now = this.context.currentTime;
    if (type === 'shot' && now - this.lastShot < 0.12) return;
    if (type === 'shot') this.lastShot = now;
    const tones: Record<string, [number, number, number]> = {
      shot: [180, 60, 0.06], kill: [240, 80, 0.07], join: [440, 720, 0.15],
      thunder: [90, 35, 0.45], upgrade: [520, 1040, 0.3], wave: [170, 100, 0.3], gate: [120, 50, 0.2], result: [440, 880, 0.6],
    };
    const tone = tones[type];
    if (!tone) return;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type === 'shot' || type === 'thunder' ? 'triangle' : 'sine';
    oscillator.frequency.setValueAtTime(tone[0], now);
    oscillator.frequency.exponentialRampToValueAtTime(tone[1], now + tone[2]);
    gain.gain.setValueAtTime(type === 'shot' ? 0.025 : 0.075, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + tone[2]);
    oscillator.connect(gain).connect(this.context.destination);
    oscillator.start(now);
    oscillator.stop(now + tone[2]);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  }
}
