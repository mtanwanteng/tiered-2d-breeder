// Audio bus + procedural cue library. See spec §7.
//
// Web Audio API + procedurally synthesized cues (sine + noise + envelope). Real
// sourced samples (CC0/CC-BY per spec §7) can drop in later by adding `audio:`
// asset paths to the theme manifest and routing through this same bus.
//
// The bus is a lazy singleton — the AudioContext is created on first call and
// must be resumed by a user gesture (browser autoplay policy). main.ts wires a
// one-shot global pointerdown handler to resume on first interaction.
//
// Loudness rules from spec §7 are approximated via per-cue gain stages:
//   P1 (loudest)  — cello-bind/retire, brass-clasp ............... ~−14 LUFS
//   P2 (middle)   — combine-knock, singing-bowl, paper-rustle .... ~−18 LUFS
//   P3 (subtle)   — post-commit cello breath, room tone .......... ~−25 LUFS

class AudioBus {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private muted = false;
  // Cue kill-switch. Default: disabled — synthesizers sounded irritating during
  // playtest, parking until we replace with sourced samples or refine the
  // procedural patches. The cue call sites in main.ts stay wired so flipping
  // this back to false (audio.setDisabled(false)) re-enables everything in
  // one line. The AudioContext init still happens so resume() is harmless.
  private disabled = true;

  /** Toggle the entire cue layer. Cues are disabled by default. */
  setDisabled(disabled: boolean): void {
    this.disabled = disabled;
  }

  /** Lazy-initialize the AudioContext. Browser autoplay policy may leave it
   *  suspended — call resume() on the first user gesture. */
  private ensureCtx(): AudioContext | null {
    if (this.ctx) return this.ctx;
    if (typeof window === "undefined") return null;
    const Ctor = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.85;
    this.master.connect(this.ctx.destination);
    return this.ctx;
  }

  /** Call from a user gesture handler so the AudioContext can produce sound. */
  resume(): void {
    const ctx = this.ensureCtx();
    if (ctx && ctx.state === "suspended") {
      void ctx.resume();
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.master) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.85, this.ctx?.currentTime ?? 0, 0.05);
    }
  }

  // ────────────────────────────────────────────────────────────────────
  // P1 — held-breath cello (bind hold)
  // ────────────────────────────────────────────────────────────────────

  /** Start a sustained cello tone at fundamental Hz. Returns a handle that
   *  can resolve (up a fifth + decay) or fadeOut (graceful exhale). */
  startCelloSustain(fundamentalHz = 98 /* G2 */): CelloSustainHandle {
    if (this.disabled) return NULL_CELLO_HANDLE;
    const ctx = this.ensureCtx();
    if (!ctx || !this.master) return NULL_CELLO_HANDLE;

    const t0 = ctx.currentTime;
    const out = ctx.createGain();
    out.gain.value = 0;
    out.connect(this.master);

    // Soft attack — the "inhale" the spec describes.
    out.gain.linearRampToValueAtTime(0.0, t0);
    out.gain.linearRampToValueAtTime(0.16, t0 + 0.7);

    // Cello-ish timbre via 3 detuned saw waves (root + minor 7th overtones)
    // through a low-pass to tame the brightness, plus a slow tremolo for body.
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 900;
    lp.Q.value = 0.6;
    lp.connect(out);

    const oscs: OscillatorNode[] = [];
    [-7, 0, 7].forEach((cents) => {
      const o = ctx.createOscillator();
      o.type = "sawtooth";
      o.frequency.value = fundamentalHz;
      o.detune.value = cents;
      o.connect(lp);
      o.start(t0);
      oscs.push(o);
    });
    // Soft 5th harmonic for warmth
    const o5 = ctx.createOscillator();
    o5.type = "sine";
    o5.frequency.value = fundamentalHz * 3;
    const harmGain = ctx.createGain();
    harmGain.gain.value = 0.06;
    o5.connect(harmGain).connect(lp);
    o5.start(t0);
    oscs.push(o5);

    // Tremolo (slow amplitude wobble — ~5Hz)
    const trem = ctx.createOscillator();
    trem.type = "sine";
    trem.frequency.value = 5;
    const tremGain = ctx.createGain();
    tremGain.gain.value = 0.025;
    trem.connect(tremGain).connect(out.gain);
    trem.start(t0);
    oscs.push(trem);

    return {
      resolve: () => {
        if (!this.ctx) return;
        const tn = this.ctx.currentTime;
        // Up a fifth: G2 → D3 (mul 1.5)
        oscs.forEach((o, i) => {
          if (i < 3) {
            o.frequency.setTargetAtTime(fundamentalHz * 1.5, tn, 0.08);
          } else if (i === 3) {
            // 5th harmonic shifts too
            o.frequency.setTargetAtTime(fundamentalHz * 1.5 * 3, tn, 0.08);
          }
        });
        out.gain.setTargetAtTime(0.22, tn, 0.05);
        // Then long decay
        out.gain.setTargetAtTime(0.0, tn + 0.9, 0.5);
        oscs.forEach((o) => o.stop(tn + 2.2));
      },
      fadeOut: () => {
        if (!this.ctx) return;
        const tn = this.ctx.currentTime;
        // Spec §3.3: cello breath releases (G2 → F2, 600ms decay)
        oscs.forEach((o, i) => {
          if (i < 3) o.frequency.setTargetAtTime(fundamentalHz * 0.89, tn, 0.12);
          else if (i === 3) o.frequency.setTargetAtTime(fundamentalHz * 0.89 * 3, tn, 0.12);
        });
        out.gain.setTargetAtTime(0.0, tn, 0.2);
        oscs.forEach((o) => o.stop(tn + 0.8));
      },
      stop: () => {
        if (!this.ctx) return;
        const tn = this.ctx.currentTime;
        out.gain.setTargetAtTime(0.0, tn, 0.05);
        oscs.forEach((o) => o.stop(tn + 0.2));
      },
    };
  }

  // ────────────────────────────────────────────────────────────────────
  // P1/P2 — one-shot cues
  // ────────────────────────────────────────────────────────────────────

  /** Brass clasp snap (~340ms): leather-press + brass tonic + ringy click. */
  playClaspSnap(): void {
    if (this.disabled) return;
    const ctx = this.ensureCtx();
    if (!ctx || !this.master) return;
    const t0 = ctx.currentTime;

    // Leather press (soft thump, low-mid noise burst)
    {
      const noise = makeNoiseBuffer(ctx, 0.12);
      const src = ctx.createBufferSource();
      src.buffer = noise;
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 240;
      bp.Q.value = 1.4;
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.0, t0);
      env.gain.linearRampToValueAtTime(0.32, t0 + 0.005);
      env.gain.exponentialRampToValueAtTime(0.001, t0 + 0.12);
      src.connect(bp).connect(env).connect(this.master);
      src.start(t0);
      src.stop(t0 + 0.13);
    }

    // Brass tonic — short bell-like FM tone
    {
      const carrier = ctx.createOscillator();
      carrier.type = "sine";
      carrier.frequency.value = 660;
      const mod = ctx.createOscillator();
      mod.type = "sine";
      mod.frequency.value = 990;
      const modGain = ctx.createGain();
      modGain.gain.value = 220;
      mod.connect(modGain).connect(carrier.frequency);
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.0, t0);
      env.gain.linearRampToValueAtTime(0.18, t0 + 0.008);
      env.gain.exponentialRampToValueAtTime(0.001, t0 + 0.34);
      carrier.connect(env).connect(this.master);
      mod.start(t0);
      carrier.start(t0);
      mod.stop(t0 + 0.36);
      carrier.stop(t0 + 0.36);
    }
  }

  /** Tile placed on the writing desk — soft paper-on-wood thud, ~80ms. Lighter
   *  body than the combine press so it reads as a separate, lower-stakes event. */
  playDeskTap(): void {
    if (this.disabled) return;
    const ctx = this.ensureCtx();
    if (!ctx || !this.master) return;
    const t0 = ctx.currentTime;

    // Wood-body thud — sine glide from 160→110Hz
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(160, t0);
    o.frequency.exponentialRampToValueAtTime(110, t0 + 0.06);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0, t0);
    env.gain.linearRampToValueAtTime(0.11, t0 + 0.003);
    env.gain.exponentialRampToValueAtTime(0.001, t0 + 0.08);
    o.connect(env).connect(this.master);
    o.start(t0);
    o.stop(t0 + 0.09);

    // Paper-texture transient
    const noise = makeNoiseBuffer(ctx, 0.05);
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 2400;
    bp.Q.value = 0.6;
    const nenv = ctx.createGain();
    nenv.gain.setValueAtTime(0.05, t0);
    nenv.gain.exponentialRampToValueAtTime(0.001, t0 + 0.05);
    src.connect(bp).connect(nenv).connect(this.master);
    src.start(t0);
    src.stop(t0 + 0.06);
  }

  /** Idea bloom — peaceful chime. Sine partials at inharmonic ratios (1.0,
   *  2.4, 3.0, 4.2, 5.5×) — the same ratios real bells and chimes ring at,
   *  which is what gives them the "shimmering" character vs a pure-tone ding.
   *  Partials are slightly staggered in onset and have individual decay times,
   *  so the bloom rings and decays organically over ~700ms. */
  playIdeaBloom(): void {
    if (this.disabled) return;
    const ctx = this.ensureCtx();
    const master = this.master;
    if (!ctx || !master) return;
    const t0 = ctx.currentTime;

    // Fundamental — C5 sits in the peaceful range (warm, not piercing).
    const fundamental = 528;

    // Bell-tone partial spec. Each ratio is what makes a chime a chime
    // (NOT integer harmonics — those would give a brass-y stack instead).
    const partials: ReadonlyArray<{
      ratio: number; gain: number; attack: number; decay: number; offset: number;
    }> = [
      { ratio: 1.00, gain: 0.55, attack: 0.008, decay: 0.70, offset: 0.000 }, // hum
      { ratio: 2.40, gain: 0.40, attack: 0.010, decay: 0.55, offset: 0.012 }, // tierce
      { ratio: 2.97, gain: 0.30, attack: 0.012, decay: 0.45, offset: 0.020 }, // fifth
      { ratio: 4.07, gain: 0.20, attack: 0.014, decay: 0.32, offset: 0.028 }, // upper
      { ratio: 5.42, gain: 0.12, attack: 0.018, decay: 0.24, offset: 0.034 }, // shimmer
    ];

    partials.forEach((p, i) => {
      const start = t0 + p.offset;
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = fundamental * p.ratio;
      // Tiny alternating detune to give the partials slight movement
      o.detune.value = (i % 2 === 0 ? 1 : -1) * 4;
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.0, start);
      env.gain.linearRampToValueAtTime(p.gain, start + p.attack);
      env.gain.exponentialRampToValueAtTime(0.001, start + p.attack + p.decay);
      o.connect(env).connect(master);
      o.start(start);
      o.stop(start + p.attack + p.decay + 0.05);
    });

    // Very quiet high-passed paper-sparkle for the "ink on parchment" texture.
    // Tucked far under the chime so it reads as room rather than a layer.
    const noise = makeNoiseBuffer(ctx, 0.55);
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 5200;
    const nenv = ctx.createGain();
    nenv.gain.setValueAtTime(0.0, t0);
    nenv.gain.linearRampToValueAtTime(0.012, t0 + 0.14);
    nenv.gain.exponentialRampToValueAtTime(0.001, t0 + 0.5);
    src.connect(hp).connect(nenv).connect(master);
    src.start(t0);
    src.stop(t0 + 0.52);
  }

  /** Combine press — earthy woody knock with ±2st pitch variation, ~180ms.
   *  Sub-thump (~90Hz) for chest body, sine glide at 180Hz for wood resonance,
   *  soft mid-band noise for paper-on-leather texture. No bright click. */
  playCombineKnock(): void {
    if (this.disabled) return;
    const ctx = this.ensureCtx();
    if (!ctx || !this.master) return;
    const t0 = ctx.currentTime;
    const cents = (Math.random() * 4 - 2) * 100;
    const baseHz = 180 * Math.pow(2, cents / 1200);

    // Sub-thump — chest body, very short, drops octave-ish
    const sub = ctx.createOscillator();
    sub.type = "sine";
    sub.frequency.setValueAtTime(baseHz * 0.5, t0);
    sub.frequency.exponentialRampToValueAtTime(baseHz * 0.35, t0 + 0.06);
    const subEnv = ctx.createGain();
    subEnv.gain.setValueAtTime(0.0, t0);
    subEnv.gain.linearRampToValueAtTime(0.2, t0 + 0.006);
    subEnv.gain.exponentialRampToValueAtTime(0.001, t0 + 0.09);
    sub.connect(subEnv).connect(this.master);
    sub.start(t0);
    sub.stop(t0 + 0.1);

    // Wood-body resonance — main tone, slight downward glide, longer decay than sub
    const body = ctx.createOscillator();
    body.type = "sine";
    body.frequency.setValueAtTime(baseHz * 1.3, t0);
    body.frequency.exponentialRampToValueAtTime(baseHz, t0 + 0.05);
    const bodyEnv = ctx.createGain();
    bodyEnv.gain.setValueAtTime(0.0, t0);
    bodyEnv.gain.linearRampToValueAtTime(0.24, t0 + 0.005);
    bodyEnv.gain.exponentialRampToValueAtTime(0.001, t0 + 0.18);
    body.connect(bodyEnv).connect(this.master);
    body.start(t0);
    body.stop(t0 + 0.2);

    // Mid-band paper-on-leather texture — dampened (no bright click)
    const noise = makeNoiseBuffer(ctx, 0.08);
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 600;
    bp.Q.value = 0.85;
    const nenv = ctx.createGain();
    nenv.gain.setValueAtTime(0.0, t0);
    nenv.gain.linearRampToValueAtTime(0.13, t0 + 0.004);
    nenv.gain.exponentialRampToValueAtTime(0.001, t0 + 0.08);
    src.connect(bp).connect(nenv).connect(this.master);
    src.start(t0);
    src.stop(t0 + 0.09);
  }

  /** Combine impossible — soft inkwell tap ~80ms. */
  playInkwellTap(): void {
    if (this.disabled) return;
    const ctx = this.ensureCtx();
    if (!ctx || !this.master) return;
    const t0 = ctx.currentTime;
    const noise = makeNoiseBuffer(ctx, 0.08);
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 900;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0, t0);
    env.gain.linearRampToValueAtTime(0.1, t0 + 0.003);
    env.gain.exponentialRampToValueAtTime(0.001, t0 + 0.08);
    src.connect(lp).connect(env).connect(this.master);
    src.start(t0);
    src.stop(t0 + 0.09);
  }

  /** Singing bowl ~1.4s tail. Fundamental ~196Hz with overtones. */
  playSingingBowl(): void {
    if (this.disabled) return;
    const ctx = this.ensureCtx();
    if (!ctx || !this.master) return;
    const t0 = ctx.currentTime;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0, t0);
    out.gain.linearRampToValueAtTime(0.28, t0 + 0.04);
    out.gain.exponentialRampToValueAtTime(0.001, t0 + 1.4);
    out.connect(this.master);

    // Fundamental + 2 overtones for that shimmer
    [196, 392 * 1.005, 588 * 0.998].forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.value = i === 0 ? 1.0 : i === 1 ? 0.55 : 0.32;
      o.connect(g).connect(out);
      o.start(t0);
      o.stop(t0 + 1.45);
    });
  }

  /** Page turn — old paper rustle ~700ms. */
  playPaperRustle(): void {
    if (this.disabled) return;
    const ctx = this.ensureCtx();
    if (!ctx || !this.master) return;
    const t0 = ctx.currentTime;
    const noise = makeNoiseBuffer(ctx, 0.7);
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 3200;
    bp.Q.value = 0.8;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0, t0);
    env.gain.linearRampToValueAtTime(0.08, t0 + 0.05);
    env.gain.linearRampToValueAtTime(0.05, t0 + 0.35);
    env.gain.exponentialRampToValueAtTime(0.001, t0 + 0.7);
    src.connect(bp).connect(env).connect(this.master);
    src.start(t0);
    src.stop(t0 + 0.72);
  }

  /** Brush-on-canvas — looped low during frontispiece reveal. Returns a handle
   *  whose stop() ends the loop. */
  startBrushCanvas(): { stop: () => void } {
    if (this.disabled) return { stop: () => {} };
    const ctx = this.ensureCtx();
    if (!ctx || !this.master) return { stop: () => {} };
    const t0 = ctx.currentTime;
    const noise = makeNoiseBuffer(ctx, 1.4, true);
    const src = ctx.createBufferSource();
    src.buffer = noise;
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 2200;
    bp.Q.value = 0.5;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0, t0);
    env.gain.linearRampToValueAtTime(0.05, t0 + 0.2);
    src.connect(bp).connect(env).connect(this.master);
    src.start(t0);
    return {
      stop: () => {
        if (!this.ctx) return;
        const tn = this.ctx.currentTime;
        env.gain.setTargetAtTime(0.0, tn, 0.1);
        src.stop(tn + 0.5);
      },
    };
  }

  /** Cathedral bell — once per run, ~4s tail. */
  playCathedralBell(): void {
    if (this.disabled) return;
    const ctx = this.ensureCtx();
    if (!ctx || !this.master) return;
    const t0 = ctx.currentTime;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0, t0);
    out.gain.linearRampToValueAtTime(0.42, t0 + 0.02);
    out.gain.exponentialRampToValueAtTime(0.001, t0 + 4);
    out.connect(this.master);

    // FM bell — carrier with a fast-decaying modulator for the strike,
    // plus partials for body.
    const fundamentals = [110, 220 * 1.003, 330 * 0.997, 440 * 1.004];
    fundamentals.forEach((f, i) => {
      const carrier = ctx.createOscillator();
      carrier.type = "sine";
      carrier.frequency.value = f;
      const mod = ctx.createOscillator();
      mod.type = "sine";
      mod.frequency.value = f * 2.4;
      const modEnv = ctx.createGain();
      modEnv.gain.setValueAtTime(f * 1.2, t0);
      modEnv.gain.exponentialRampToValueAtTime(0.001, t0 + 0.6);
      mod.connect(modEnv).connect(carrier.frequency);
      const partialGain = ctx.createGain();
      partialGain.gain.value = i === 0 ? 1.0 : i === 1 ? 0.55 : i === 2 ? 0.32 : 0.18;
      carrier.connect(partialGain).connect(out);
      mod.start(t0);
      carrier.start(t0);
      mod.stop(t0 + 4.1);
      carrier.stop(t0 + 4.1);
    });
  }
}

// ────────────────────────────────────────────────────────────────────
// helpers
// ────────────────────────────────────────────────────────────────────

function makeNoiseBuffer(ctx: AudioContext, durationSec: number, smooth = false): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const length = Math.max(1, Math.floor(sampleRate * durationSec));
  const buf = ctx.createBuffer(1, length, sampleRate);
  const data = buf.getChannelData(0);
  if (smooth) {
    // Brownian (smooth) noise — slower variation than white
    let last = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    }
  } else {
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  }
  return buf;
}

export interface CelloSustainHandle {
  /** Resolve up a fifth + decay (commit). */
  resolve(): void;
  /** Graceful exhale (cancel). */
  fadeOut(): void;
  /** Hard stop. */
  stop(): void;
}

const NULL_CELLO_HANDLE: CelloSustainHandle = {
  resolve() {},
  fadeOut() {},
  stop() {},
};

export const audio = new AudioBus();
