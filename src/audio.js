// Procedural Web Audio API sound engine for ambient synthwave and realistic car engine rumble

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.isMuted = true;
    this.isPlaying = false;
    this.engineGain = null;
    this.ambientGain = null;
    this.engineOsc1 = null;
    this.engineOsc2 = null;
    this.engineFilter = null;
    this.rpm = 800; // Idle RPM
    this.targetRpm = 800;
  }

  init() {
    if (this.ctx) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AudioContext();

    // Master volume
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.4, this.ctx.currentTime);
    this.masterGain.connect(this.ctx.destination);

    this.setupAmbientSynth();
    this.setupEngineSynth();
  }

  setupAmbientSynth() {
    this.ambientGain = this.ctx.createGain();
    this.ambientGain.gain.setValueAtTime(0.18, this.ctx.currentTime);
    this.ambientGain.connect(this.masterGain);

    // Deep synthwave warm drone chords: F# minor (F#2, C#3, A3, E4)
    const freqs = [92.5, 138.59, 220.0, 329.63];
    freqs.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      osc.type = idx % 2 === 0 ? 'sawtooth' : 'sine';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

      // Subtle detune for lush synth chorus
      osc.detune.setValueAtTime((idx - 1.5) * 8, this.ctx.currentTime);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(450, this.ctx.currentTime);

      // Slow LFO for dreamy breathing
      const lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();
      lfo.frequency.setValueAtTime(0.15 + idx * 0.05, this.ctx.currentTime);
      lfoGain.gain.setValueAtTime(120, this.ctx.currentTime);
      lfo.connect(filter.frequency);
      lfo.start();

      gain.gain.setValueAtTime(0.04 / (idx + 1), this.ctx.currentTime);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ambientGain);
      osc.start();
    });
  }

  setupEngineSynth() {
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.setValueAtTime(0.22, this.ctx.currentTime);
    this.engineGain.connect(this.masterGain);

    // Dual oscillator engine combustion simulation
    this.engineOsc1 = this.ctx.createOscillator();
    this.engineOsc1.type = 'sawtooth';
    this.engineOsc1.frequency.setValueAtTime(32, this.ctx.currentTime);

    this.engineOsc2 = this.ctx.createOscillator();
    this.engineOsc2.type = 'triangle';
    this.engineOsc2.frequency.setValueAtTime(48, this.ctx.currentTime);

    // Noise buffer for exhaust rumble
    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(120, this.ctx.currentTime);
    noiseFilter.Q.setValueAtTime(2.5, this.ctx.currentTime);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.12, this.ctx.currentTime);

    whiteNoise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.engineGain);
    whiteNoise.start();

    // Lowpass filter for car engine body muffling
    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.setValueAtTime(240, this.ctx.currentTime);

    const oscMix = this.ctx.createGain();
    oscMix.gain.setValueAtTime(0.15, this.ctx.currentTime);

    this.engineOsc1.connect(this.engineFilter);
    this.engineOsc2.connect(this.engineFilter);
    this.engineFilter.connect(oscMix);
    oscMix.connect(this.engineGain);

    this.engineOsc1.start();
    this.engineOsc2.start();

    // Loop to smoothly update RPM
    this.updateEngineRpm();
  }

  updateEngineRpm() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    // Smooth damp towards target RPM
    this.rpm += (this.targetRpm - this.rpm) * 0.08;

    const fundamentalHz = Math.max(20, (this.rpm / 60) * 2.5); // V8 cylinder fire frequency
    if (this.engineOsc1 && this.engineOsc2) {
      this.engineOsc1.frequency.setValueAtTime(fundamentalHz, now);
      this.engineOsc2.frequency.setValueAtTime(fundamentalHz * 1.5, now);
      if (this.engineFilter) {
        this.engineFilter.frequency.setValueAtTime(fundamentalHz * 4.5 + 100, now);
      }
    }

    requestAnimationFrame(() => this.updateEngineRpm());
  }

  toggleMute() {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    this.isMuted = !this.isMuted;
    if (this.masterGain) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.linearRampToValueAtTime(this.isMuted ? 0 : 0.45, now + 0.15);
    }
    return !this.isMuted;
  }

  unmute() {
    if (this.isMuted) {
      this.toggleMute();
    }
  }

  revEngine(intensity = 1.0) {
    if (!this.ctx) this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    // Rev up to 4800 RPM then settle back to idle 850
    this.targetRpm = 1000 + 3800 * intensity;
    setTimeout(() => {
      this.targetRpm = 850;
    }, 450);
  }

  playHorn() {
    if (!this.ctx) this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    const now = this.ctx.currentTime;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.frequency.setValueAtTime(435, now); // F4
    osc2.frequency.setValueAtTime(545, now); // C#5

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.2, now + 0.02);
    gain.gain.linearRampToValueAtTime(0.18, now + 0.28);
    gain.gain.linearRampToValueAtTime(0, now + 0.35);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.masterGain);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.36);
    osc2.stop(now + 0.36);
  }

  playChime() {
    if (!this.ctx) this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    const now = this.ctx.currentTime;
    const freqs = [587.33, 880.0, 1174.66]; // D5, A5, D6
    freqs.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);

      gain.gain.setValueAtTime(0, now + idx * 0.08);
      gain.gain.linearRampToValueAtTime(0.12, now + idx * 0.08 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 1.2);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 1.25);
    });
  }
}

export const sound = new SoundEngine();
