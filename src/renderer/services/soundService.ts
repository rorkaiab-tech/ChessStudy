class SoundService {
  private ctx: AudioContext | null = null;
  private volume: number = 0.5; // Range: 0 to 1

  private initCtx() {
    if (!this.ctx) {
      // @ts-ignore
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
  }

  getVolume(): number {
    return this.volume;
  }

  private createGain(ctx: AudioContext, duration: number, customVolumeMultiplier = 1): GainNode {
    const gain = ctx.createGain();
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(this.volume * customVolumeMultiplier, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    gain.connect(ctx.destination);
    return gain;
  }

  playMove() {
    const ctx = this.initCtx();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = this.createGain(ctx, 0.08, 0.6);
    const now = ctx.currentTime;

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.08);

    osc.connect(gain);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  playCapture() {
    const ctx = this.initCtx();
    if (!ctx) return;

    const now = ctx.currentTime;
    const duration = 0.08;

    // Wood thump
    const osc = ctx.createOscillator();
    const oscGain = this.createGain(ctx, duration, 0.5);
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(170, now);
    osc.frequency.exponentialRampToValueAtTime(90, now + duration);
    osc.connect(oscGain);
    osc.start(now);
    osc.stop(now + duration + 0.02);

    // Snap noise
    try {
      const bufferSize = ctx.sampleRate * 0.03; // 30ms of noise
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1000, now);

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(this.volume * 0.3, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.03);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(ctx.destination);

      noise.start(now);
      noise.stop(now + 0.04);
    } catch (e) {
      // Fallback if buffer creation fails
    }
  }

  playCastle() {
    this.playMove();
    setTimeout(() => this.playMove(), 100);
  }

  playCheck() {
    const ctx = this.initCtx();
    if (!ctx) return;

    const now = ctx.currentTime;
    const duration = 0.4;

    const gain = this.createGain(ctx, duration, 0.7);

    // Chime with dual frequencies (beating effect)
    const osc1 = ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(440, now);

    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(443, now);

    osc1.connect(gain);
    osc2.connect(gain);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + duration + 0.05);
    osc2.stop(now + duration + 0.05);
  }

  playCheckmate() {
    const ctx = this.initCtx();
    if (!ctx) return;

    const now = ctx.currentTime;
    const duration = 1.5;
    const gain = this.createGain(ctx, duration, 0.8);

    // Play a majestic minor-to-major resolution or warm rich chord (C major: C3, G3, C4, E4)
    const freqs = [130.81, 196.00, 261.63, 329.63]; // C3, G3, C4, E4
    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      
      // Gentle arpeggio delay
      const oscGain = ctx.createGain();
      oscGain.gain.setValueAtTime(0, now);
      oscGain.gain.linearRampToValueAtTime(this.volume * 0.2, now + 0.05 * idx);
      oscGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      osc.connect(oscGain);
      oscGain.connect(ctx.destination);
      
      osc.start(now);
      osc.stop(now + duration + 0.1);
    });
  }

  playPromotion() {
    const ctx = this.initCtx();
    if (!ctx) return;

    const now = ctx.currentTime;
    const duration = 0.3;
    const osc = ctx.createOscillator();
    const gain = this.createGain(ctx, duration, 0.5);

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(261.63, now); // C4
    osc.frequency.exponentialRampToValueAtTime(523.25, now + duration); // C5

    osc.connect(gain);
    osc.start(now);
    osc.stop(now + duration + 0.05);
  }

  playSuccess() {
    const ctx = this.initCtx();
    if (!ctx) return;

    const now = ctx.currentTime;
    const duration = 0.6;

    // Arpeggiated C major triad (C5 - E5 - G5 - C6)
    const freqs = [523.25, 659.25, 783.99, 1046.50];
    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.06);

      const oscGain = ctx.createGain();
      const noteStart = now + i * 0.06;
      oscGain.gain.setValueAtTime(0, noteStart);
      oscGain.gain.linearRampToValueAtTime(this.volume * 0.15, noteStart + 0.01);
      oscGain.gain.exponentialRampToValueAtTime(0.0001, noteStart + 0.4);

      osc.connect(oscGain);
      oscGain.connect(ctx.destination);

      osc.start(noteStart);
      osc.stop(noteStart + 0.45);
    });
  }

  playError() {
    const ctx = this.initCtx();
    if (!ctx) return;

    const now = ctx.currentTime;
    const duration = 0.3;
    const osc = ctx.createOscillator();
    const gain = this.createGain(ctx, duration, 0.6);

    // Low harsh buzzer (sawtooth / square)
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.linearRampToValueAtTime(90, now + duration);

    // Low-pass filter to make it softer and less annoying
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(400, now);

    osc.connect(filter);
    filter.connect(gain);
    osc.start(now);
    osc.stop(now + duration + 0.05);
  }

  playHover() {
    const ctx = this.initCtx();
    if (!ctx) return;

    const now = ctx.currentTime;
    const duration = 0.02;
    const osc = ctx.createOscillator();
    const gain = this.createGain(ctx, duration, 0.1);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, now);

    osc.connect(gain);
    osc.start(now);
    osc.stop(now + duration + 0.01);
  }
}

export const sound = new SoundService();
