import type { BedTrack } from '@/lib/schemas';

/**
 * Sound beds, synthesised in the browser from the descriptors in
 * `data/bed-tracks.json`.
 *
 * PDR 5.7 makes `bed_tracks.license` mandatory, which is the tell: the
 * production design ships audio files and has to answer for where they came
 * from. Synthesising instead removes that question entirely and keeps the
 * repository small, at the cost of a plainer sound.
 *
 * Explicitly not binaural. Binaural beats present a different frequency to
 * each ear and are contraindicated in epilepsy; using them would mean adding a
 * question to the clinical screen. Every voice here is played identically to
 * both ears.
 */

export type Bed = {
  start: () => void;
  stop: () => void;
  setVolume: (value: number) => void;
};

/** One buffer of noise, looped. Two seconds is long enough that the loop point
 *  is inaudible under a low-pass and short enough to build instantly. */
function noiseBuffer(ctx: AudioContext, type: 'white' | 'pink' | 'brown'): AudioBuffer {
  const length = ctx.sampleRate * 2;
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);

  let brown = 0;
  // Paul Kellet's pink-noise filter — cheap, and close enough that nobody
  // running a meditation will hear the difference from a true 1/f.
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;

  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    if (type === 'white') {
      data[i] = white;
    } else if (type === 'brown') {
      brown = (brown + 0.02 * white) / 1.02;
      data[i] = brown * 3.5;
    } else {
      b0 = 0.99765 * b0 + white * 0.099046;
      b1 = 0.963 * b1 + white * 0.2965164;
      b2 = 0.57555 * b2 + white * 1.0526913;
      data[i] = (b0 + b1 + b2 + white * 0.1848) * 0.25;
    }
  }

  return buffer;
}

export function createBed(ctx: AudioContext, track: BedTrack, destination: AudioNode): Bed {
  const output = ctx.createGain();
  output.gain.value = 0;
  output.connect(destination);

  // The swell is its own stage so the listener's volume and the slow breathing
  // of the bed do not fight over one AudioParam. A signal connected to a param
  // is summed with its value, so modulating `output.gain` directly would make
  // the depth of the swell depend on how loud the person set it.
  const swell = ctx.createGain();
  swell.connect(output);

  const sources: (OscillatorNode | AudioBufferSourceNode)[] = [];
  let started = false;

  for (const voice of track.synthesis.voices) {
    const osc = ctx.createOscillator();
    osc.type = voice.type;
    osc.frequency.value = voice.hz;
    const gain = ctx.createGain();
    gain.gain.value = voice.gain;
    osc.connect(gain).connect(swell);
    sources.push(osc);
  }

  if (track.synthesis.noise) {
    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer(ctx, track.synthesis.noise.type);
    source.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = track.synthesis.noise.lowpass_hz;
    const gain = ctx.createGain();
    gain.gain.value = track.synthesis.noise.gain;
    source.connect(filter).connect(gain).connect(swell);
    sources.push(source);
  }

  // The slow swell. Without it a pure drone reads as a machine humming rather
  // than as something breathing. It rides between `1 - depth` and `1`, so the
  // bed only ever ducks below its set level and never jumps above it.
  const depth = track.synthesis.lfo?.depth ?? 0;
  swell.gain.value = 1 - depth / 2;

  if (track.synthesis.lfo) {
    const lfo = ctx.createOscillator();
    lfo.frequency.value = track.synthesis.lfo.hz;
    const amount = ctx.createGain();
    amount.gain.value = depth / 2;
    lfo.connect(amount).connect(swell.gain);
    sources.push(lfo);
  }

  return {
    start() {
      if (started) return;
      started = true;
      for (const source of sources) source.start();
    },
    stop() {
      for (const source of sources) {
        try {
          source.stop();
        } catch {
          // Already stopped, or never started. Either way there is nothing to
          // do and nothing worth telling anyone about.
        }
      }
      swell.disconnect();
      output.disconnect();
    },
    setVolume(value) {
      // A ramp rather than a jump: a step change in gain on a sustained tone
      // is audible as a click.
      output.gain.cancelScheduledValues(ctx.currentTime);
      output.gain.setTargetAtTime(value, ctx.currentTime, 0.08);
    },
  };
}
