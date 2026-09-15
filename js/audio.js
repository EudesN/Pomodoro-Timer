/**
 * AUDIO MODULE - POMUS
 * Multi-layer resilient sound system:
 * 1. Native OS Bridge via PipeWire/PulseAudio (/api/play-sound) when running under local server
 * 2. Web Audio API Procedural Synthesizer (Zero-latency procedural chimes & soft button clicks)
 * 3. HTML5 Audio fallback using local WAV assets (assets/sounds/)
 */

class SoundSynthesizer {
  constructor() {
    this.ctx = null;
    this.audioCache = new Map();
    this.soundFiles = ['bell', 'zen', 'beep', 'marimba', 'tick'];
    this.nativeBridgeAvailable = null; // null = untried, true/false
    this.isMuted = false;
  }

  setMuted(muted) {
    this.isMuted = !!muted;
  }

  _getAudio(soundName) {
    if (!this.audioCache.has(soundName)) {
      try {
        const audio = new Audio(`assets/sounds/${soundName}.wav`);
        audio.preload = 'none';
        this.audioCache.set(soundName, audio);
      } catch (e) {
        return null;
      }
    }
    return this.audioCache.get(soundName);
  }

  _initContext() {
    try {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
    } catch (e) {
      console.warn('AudioContext init non-fatal notice:', e);
    }
  }

  /**
   * Play the selected notification chime with multi-layer fallback
   * @param {string} soundType - 'bell', 'zen', 'beep', 'marimba'
   * @param {number} volume - 0 to 1
   * @param {boolean} isPreview - whether this is an explicit user preview
   */
  async playAlert(soundType = 'bell', volume = 0.8, isPreview = false) {
    const numVol = (volume !== undefined && volume !== null) ? Number(volume) : 0.8;
    // If muted and not a preview, do not play
    if ((this.isMuted || numVol <= 0) && !isPreview) return;
    const safeVolume = Math.min(1, Math.max(0.01, numVol));

    // Layer 1: If on local HTTP server, try native bridge first
    if (window.location.protocol.startsWith('http')) {
      const bridgeSuccess = await this._triggerNativeBridge(soundType, safeVolume);
      if (bridgeSuccess) {
        return; // Handled cleanly by native OS player (pw-play/paplay)
      }
    }

    // Layer 2: Web Audio API synthesis (Zero latency in browser)
    let webAudioSuccess = false;
    try {
      this._initContext();
      if (this.ctx && this.ctx.state !== 'closed') {
        if (this.ctx.state === 'suspended') {
          await this.ctx.resume().catch(() => {});
        }
        if (this.ctx.state === 'running') {
          switch (soundType) {
            case 'zen':
              this._playZenBowl(safeVolume);
              break;
            case 'beep':
              this._playDigitalBeep(safeVolume);
              break;
            case 'marimba':
              this._playMarimba(safeVolume);
              break;
            case 'bell':
            default:
              this._playBellChime(safeVolume);
              break;
          }
          webAudioSuccess = true;
        }
      }
    } catch (e) {
      console.warn('Web Audio playback error:', e);
    }

    // Layer 3: HTML5 Audio fallback
    if (!webAudioSuccess) {
      this._playHtml5Audio(soundType, safeVolume);
    }
  }

  /**
   * Play an ultra-soft, gentle tactile tap
   * Only used for the main Start/Pause timer button
   */
  async playButtonClick(volume = 0.025) {
    if (this.isMuted) return;

    try {
      this._initContext();
      if (this.ctx && this.ctx.state === 'running') {
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        // Gentle low drop from 280Hz to 160Hz for a smooth, subtle tactile tap
        osc.frequency.setValueAtTime(280, now);
        osc.frequency.exponentialRampToValueAtTime(160, now + 0.018);

        const safeGain = Math.max(0.0001, (volume || 0.025) * 0.4);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(safeGain, now + 0.003);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.02);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.022);
        return;
      }
    } catch (e) {}

    // Fallback: If on local HTTP server, trigger gentle click sound
    if (window.location.protocol.startsWith('http')) {
      this._triggerNativeBridge('click', 0.02);
    }
  }

  /**
   * Play subtle tick sound during active focus
   */
  async playTick(volume = 0.15) {
    if (this.isMuted || volume <= 0) return;

    try {
      this._initContext();
      if (this.ctx && this.ctx.state === 'running') {
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(850, now);

        const safeVol = Math.max(0.0001, volume * 0.08);
        gain.gain.setValueAtTime(safeVol, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.02);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.02);
        return;
      }
    } catch (e) {}

    // Fallback to native bridge or HTML5 tick
    if (window.location.protocol.startsWith('http')) {
      this._triggerNativeBridge('tick', volume * 0.4);
    } else {
      this._playHtml5Audio('tick', volume * 0.4);
    }
  }

  /**
   * Trigger native backend player (/api/play-sound)
   * Returns true if server accepted the request
   */
  async _triggerNativeBridge(soundName, volume) {
    if (!window.location.protocol.startsWith('http')) return false;

    try {
      const resp = await fetch(`/api/play-sound?sound=${encodeURIComponent(soundName)}&volume=${encodeURIComponent(volume)}`, {
        method: 'GET',
        cache: 'no-store'
      });
      return resp.ok;
    } catch (e) {
      return false;
    }
  }

  /**
   * HTML5 Audio element fallback
   */
  _playHtml5Audio(soundName, volume) {
    try {
      const audio = this._getAudio(soundName);
      if (!audio) return;
      audio.currentTime = 0;
      audio.volume = Math.min(1, Math.max(0.001, volume));
      const promise = audio.play();
      if (promise !== undefined) {
        promise.catch(() => {});
      }
    } catch (err) {}
  }

  /**
   * Procedural Harmonious Bell Chime (C6, E6, G6, C7)
   */
  _playBellChime(volume) {
    const now = this.ctx.currentTime;
    const masterGain = this.ctx.createGain();
    masterGain.connect(this.ctx.destination);
    masterGain.gain.setValueAtTime(Math.max(0.0001, volume * 0.45), now);

    const freqs = [1046.5, 1318.5, 1567.98, 2093.0];
    const decays = [1.8, 1.4, 1.2, 0.9];

    freqs.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const startTime = now + idx * 0.08;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);

      const peak = Math.max(0.0001, 0.3 / (idx + 1));
      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.linearRampToValueAtTime(peak, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + decays[idx]);

      osc.connect(gain);
      gain.connect(masterGain);

      osc.start(startTime);
      osc.stop(startTime + decays[idx]);
    });
  }

  /**
   * Procedural Zen Tibetan Singing Bowl
   */
  _playZenBowl(volume) {
    const now = this.ctx.currentTime;
    const masterGain = this.ctx.createGain();
    masterGain.connect(this.ctx.destination);
    masterGain.gain.setValueAtTime(Math.max(0.0001, volume * 0.45), now);

    const freqs = [432, 436, 864, 1296];

    freqs.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);

      const peak = Math.max(0.0001, 0.3 / (i + 1));
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(peak, now + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 3.0);

      osc.connect(gain);
      gain.connect(masterGain);

      osc.start(now);
      osc.stop(now + 3.1);
    });
  }

  /**
   * Procedural Digital Notification Beep
   */
  _playDigitalBeep(volume) {
    const now = this.ctx.currentTime;
    const masterGain = this.ctx.createGain();
    masterGain.connect(this.ctx.destination);
    masterGain.gain.setValueAtTime(Math.max(0.0001, volume * 0.4), now);

    const notes = [880, 1174.66];
    notes.forEach((freq, idx) => {
      const startTime = now + idx * 0.12;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.linearRampToValueAtTime(0.35, startTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.15);

      osc.connect(gain);
      gain.connect(masterGain);

      osc.start(startTime);
      osc.stop(startTime + 0.16);
    });
  }

  /**
   * Procedural Soft Marimba Tone
   */
  _playMarimba(volume) {
    const now = this.ctx.currentTime;
    const masterGain = this.ctx.createGain();
    masterGain.connect(this.ctx.destination);
    masterGain.gain.setValueAtTime(Math.max(0.0001, volume * 0.45), now);

    const chords = [523.25, 659.25, 783.99];
    chords.forEach((freq, idx) => {
      const startTime = now + idx * 0.07;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.linearRampToValueAtTime(0.35, startTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.6);

      osc.connect(gain);
      gain.connect(masterGain);

      osc.start(startTime);
      osc.stop(startTime + 0.65);
    });
  }
}

const AudioPlayer = new SoundSynthesizer();
