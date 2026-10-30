export class AudioSystem {
  constructor() {
    this.context = null;
    this.master = null;
    this.noiseBuffer = null;
    this.stepSide = 1;
    this.lastHeartbeat = 0;
    this.lastEnemyStep = 0;
    this.lastBreath = 0;
  }

  async init() {
    if (!this.context) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = 0.72;
      const compressor = this.context.createDynamicsCompressor();
      compressor.threshold.value = -18;
      compressor.ratio.value = 5;
      this.master.connect(compressor).connect(this.context.destination);
      this.noiseBuffer = this.createNoiseBuffer(2);
      this.startAmbience();
    }
    if (this.context.state === 'suspended') await this.context.resume();
  }

  createNoiseBuffer(seconds) {
    const buffer = this.context.createBuffer(1, this.context.sampleRate * seconds, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i += 1) {
      const white = Math.random() * 2 - 1;
      last = last * 0.82 + white * 0.18;
      data[i] = last * 1.8;
    }
    return buffer;
  }

  setParam(param, value, time) {
    if (param) param.setValueAtTime(value, time);
  }

  updateListener(position, yaw, pitch = 0) {
    if (!this.context) return;
    const listener = this.context.listener;
    const time = this.context.currentTime;
    const fx = -Math.sin(yaw) * Math.cos(pitch);
    const fy = Math.sin(pitch);
    const fz = -Math.cos(yaw) * Math.cos(pitch);
    this.setParam(listener.positionX, position.x, time);
    this.setParam(listener.positionY, position.y, time);
    this.setParam(listener.positionZ, position.z, time);
    this.setParam(listener.forwardX, fx, time);
    this.setParam(listener.forwardY, fy, time);
    this.setParam(listener.forwardZ, fz, time);
    this.setParam(listener.upX, 0, time);
    this.setParam(listener.upY, 1, time);
    this.setParam(listener.upZ, 0, time);
  }

  createPanner(position, maxDistance = 28) {
    const panner = this.context.createPanner();
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'inverse';
    panner.refDistance = 1.2;
    panner.maxDistance = maxDistance;
    panner.rolloffFactor = 1.35;
    const time = this.context.currentTime;
    this.setParam(panner.positionX, position.x, time);
    this.setParam(panner.positionY, position.y, time);
    this.setParam(panner.positionZ, position.z, time);
    return panner;
  }

  startAmbience() {
    const ctx = this.context;
    const droneGain = ctx.createGain();
    droneGain.gain.value = 0.05;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 160;
    droneGain.connect(filter).connect(this.master);
    [41.2, 55.3, 82.4].forEach((frequency, index) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = index === 1 ? 'triangle' : 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.value = index === 2 ? 0.1 : 0.28;
      oscillator.connect(gain).connect(droneGain);
      oscillator.start();
    });
    const air = ctx.createBufferSource();
    air.buffer = this.noiseBuffer;
    air.loop = true;
    const airFilter = ctx.createBiquadFilter();
    airFilter.type = 'bandpass';
    airFilter.frequency.value = 380;
    airFilter.Q.value = 0.5;
    const airGain = ctx.createGain();
    airGain.gain.value = 0.018;
    air.connect(airFilter).connect(airGain).connect(this.master);
    air.start();

    // ---- 恐怖氛围层 ----
    // 1. 不和谐高频弦乐式颤音（缓慢起伏）
    const tensionGain = ctx.createGain();
    tensionGain.gain.value = 0.012;
    const tensionFilter = ctx.createBiquadFilter();
    tensionFilter.type = 'bandpass';
    tensionFilter.frequency.value = 2400;
    tensionFilter.Q.value = 6;
    tensionGain.connect(tensionFilter).connect(this.master);
    [1244.5, 1318.5, 1396.9].forEach((frequency) => {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = frequency;
      osc.detune.value = (Math.random() - 0.5) * 40;
      const g = ctx.createGain();
      g.gain.value = 0.3;
      // LFO 缓慢调制音量制造起伏
      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 0.05 + Math.random() * 0.06;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.25;
      lfo.connect(lfoGain).connect(g.gain);
      lfo.start();
      osc.connect(g).connect(tensionGain);
      osc.start();
    });

    // 2. 次低频脉动（类似远处心跳/机器轰鸣）
    const throbOsc = ctx.createOscillator();
    throbOsc.type = 'sine';
    throbOsc.frequency.value = 27.5;
    const throbLfo = ctx.createOscillator();
    throbLfo.type = 'sine';
    throbLfo.frequency.value = 0.9;
    const throbLfoGain = ctx.createGain();
    throbLfoGain.gain.value = 0.02;
    const throbGain = ctx.createGain();
    throbGain.gain.value = 0.025;
    throbLfo.connect(throbLfoGain).connect(throbGain.gain);
    throbLfo.start();
    throbOsc.connect(throbGain).connect(this.master);
    throbOsc.start();

    // 3. 随机远处异响（金属刮擦/呜咽），不定时出现
    this.startRandomHorrorSounds();
  }

  startRandomHorrorSounds() {
    const scheduleNext = () => {
      const delay = 9000 + Math.random() * 16000;
      this.horrorTimer = setTimeout(() => {
        this.distantHorror();
        scheduleNext();
      }, delay);
    };
    scheduleNext();
  }

  distantHorror() {
    if (!this.context) return;
    const ctx = this.context;
    const now = ctx.currentTime;
    const kind = Math.floor(Math.random() * 3);
    if (kind === 0) {
      // 金属刮擦声
      const source = ctx.createBufferSource();
      source.buffer = this.noiseBuffer;
      source.playbackRate.value = 0.18;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(900 + Math.random() * 600, now);
      filter.frequency.exponentialRampToValueAtTime(300, now + 1.8);
      filter.Q.value = 9;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.05, now + 0.5);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 2.2);
      source.connect(filter).connect(gain).connect(this.master);
      source.start(now, Math.random());
      source.stop(now + 2.4);
    } else if (kind === 1) {
      // 低频呜咽（滑音）
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.exponentialRampToValueAtTime(70, now + 2.5);
      const tremolo = ctx.createOscillator();
      tremolo.frequency.value = 5;
      const tremoloGain = ctx.createGain();
      tremoloGain.gain.value = 0.015;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.035, now + 0.8);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 2.8);
      tremolo.connect(tremoloGain).connect(gain.gain);
      tremolo.start(now);
      tremolo.stop(now + 2.8);
      osc.connect(gain).connect(this.master);
      osc.start(now);
      osc.stop(now + 3);
    } else {
      // 远处敲击三声
      for (let i = 0; i < 3; i += 1) {
        const t = now + i * (0.5 + Math.random() * 0.15);
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(65, t);
        osc.frequency.exponentialRampToValueAtTime(38, t + 0.3);
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.001, t);
        gain.gain.exponentialRampToValueAtTime(0.07, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
        osc.connect(gain).connect(this.master);
        osc.start(t);
        osc.stop(t + 0.5);
      }
    }
  }

  footstep(position, running = false, enemy = false) {
    if (!this.context) return;
    const ctx = this.context;
    const now = ctx.currentTime;
    this.stepSide *= -1;
    const source = ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    source.playbackRate.value = enemy ? 0.55 + Math.random() * 0.15 : 0.85 + Math.random() * 0.25;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(enemy ? 280 : running ? 720 : 520, now);
    filter.frequency.exponentialRampToValueAtTime(90, now + 0.14);
    const gain = ctx.createGain();
    const volume = enemy ? 0.72 : running ? 0.55 : 0.42;
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (enemy ? 0.28 : 0.16));
    // 玩家脚步声额外叠加一层低频“踩地”冲击，更实在
    if (!enemy) {
      const thump = ctx.createOscillator();
      thump.type = 'sine';
      thump.frequency.setValueAtTime(running ? 95 : 78, now);
      thump.frequency.exponentialRampToValueAtTime(45, now + 0.09);
      const thumpGain = ctx.createGain();
      thumpGain.gain.setValueAtTime(0.001, now);
      thumpGain.gain.exponentialRampToValueAtTime(running ? 0.22 : 0.14, now + 0.01);
      thumpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      thump.connect(thumpGain).connect(this.master);
      thump.start(now);
      thump.stop(now + 0.15);
    }
    const footPosition = {
      x: position.x + Math.cos(position.yaw || 0) * 0.16 * this.stepSide,
      y: position.y - 1.45,
      z: position.z - Math.sin(position.yaw || 0) * 0.16 * this.stepSide,
    };
    const panner = this.createPanner(footPosition, enemy ? 32 : 4);
    source.connect(filter).connect(gain).connect(panner).connect(this.master);
    source.start(now, Math.random());
    source.stop(now + 0.3);
  }

  tone(frequency, duration, volume = 0.15, type = 'sine', delay = 0) {
    if (!this.context) return;
    const ctx = this.context;
    const now = ctx.currentTime + delay;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    oscillator.connect(gain).connect(this.master);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  }

  key() {
    [659, 988, 1318].forEach((frequency, index) => this.tone(frequency, 0.45, 0.12, 'sine', index * 0.09));
  }

  denied() {
    this.tone(105, 0.16, 0.18, 'square');
    this.tone(86, 0.2, 0.12, 'square', 0.14);
  }

  flashlight() {
    this.tone(1100, 0.035, 0.055, 'square');
  }

  door() {
    if (!this.context) return;
    const ctx = this.context;
    const now = ctx.currentTime;
    const oscillator = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(74, now);
    oscillator.frequency.exponentialRampToValueAtTime(31, now + 1.5);
    filter.type = 'lowpass';
    filter.frequency.value = 330;
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.19, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.6);
    oscillator.connect(filter).connect(gain).connect(this.master);
    oscillator.start();
    oscillator.stop(now + 1.7);
    this.tone(48, 0.35, 0.32, 'sine', 1.25);
  }

  enemyStep(position) {
    this.footstep({ ...position, y: 1.7 }, false, true);
  }

  breath(position) {
    if (!this.context) return;
    const ctx = this.context;
    const now = ctx.currentTime;
    const source = ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    source.playbackRate.value = 0.35;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 520;
    filter.Q.value = 1.8;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.25, now + 0.4);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.4);
    source.connect(filter).connect(gain).connect(this.createPanner(position, 24)).connect(this.master);
    source.start(now, Math.random());
    source.stop(now + 1.5);
  }

  heartbeat(intensity) {
    this.tone(52, 0.13, 0.12 + intensity * 0.16, 'sine');
    this.tone(44, 0.15, 0.09 + intensity * 0.12, 'sine', 0.17);
  }

  death() {
    if (!this.context) return;
    const ctx = this.context;
    const now = ctx.currentTime;
    const source = ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    source.playbackRate.value = 2.4;
    const distortion = ctx.createWaveShaper();
    const curve = new Float32Array(256);
    for (let i = 0; i < curve.length; i += 1) curve[i] = Math.tanh((i / 128 - 1) * 8);
    distortion.curve = curve;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.7, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.25);
    source.connect(distortion).connect(gain).connect(this.master);
    source.start();
    source.stop(now + 1.3);
    [190, 137, 73].forEach((frequency, index) => {
      const oscillator = ctx.createOscillator();
      const oscGain = ctx.createGain();
      oscillator.type = 'sawtooth';
      oscillator.frequency.setValueAtTime(frequency, now);
      oscillator.frequency.exponentialRampToValueAtTime(28, now + 1.1);
      oscGain.gain.setValueAtTime(0.16, now);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 1.15);
      oscillator.connect(oscGain).connect(this.master);
      oscillator.start(now + index * 0.02);
      oscillator.stop(now + 1.2);
    });
  }

  escape() {
    [220, 330, 440, 660].forEach((frequency, index) => this.tone(frequency, 1.2, 0.1, 'sine', index * 0.18));
  }
}
