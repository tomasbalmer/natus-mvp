import { parseSsml, type SsmlSegment } from './ssml';

/**
 * Speech, behind the shape PDR 9.5 defines for the server provider.
 *
 * The PDR's production path is Google Cloud TTS, which takes SSML and returns
 * an audio file. A static page cannot hold that key, so the browser's
 * SpeechSynthesis stands in — but the interface is kept: a request goes in, a
 * handle comes back, and swapping the provider is one implementation.
 *
 * Two things SpeechSynthesis does not do, which this file has to. It does not
 * understand SSML, so the script is parsed into segments here and the pauses
 * become timers. And it does not expose its output to the audio graph, so the
 * voice volume is set on each utterance rather than on a gain node — the one
 * place the two-gain-node design of `player.ts` had to bend to the platform.
 */

export type SynthesisRequest = {
  ssml: string;
  /** Read at the start of every segment, so moving the slider mid-practice
   *  takes effect on the next sentence rather than at the end. */
  volume: () => number;
};

export type SynthesisEvents = {
  onSegment?: (index: number, total: number, segment: SsmlSegment) => void;
  onDone?: () => void;
  onError?: (reason: string) => void;
};

export type SpeechHandle = {
  stop: () => void;
  /** True until the queue is exhausted or stopped. */
  isRunning: () => boolean;
};

export type SpeechProvider = {
  synthesize: (request: SynthesisRequest, events?: SynthesisEvents) => SpeechHandle;
  isAvailable: () => boolean;
};

function speechApi(): SpeechSynthesis | null {
  return typeof globalThis.speechSynthesis === 'undefined' ? null : globalThis.speechSynthesis;
}

/** Prefers a Spanish voice, and prefers a Latin American one among those.
 *  Peninsular Spanish reading rioplatense copy is jarring enough to break the
 *  practice. */
export function preferredVoice(voices: readonly SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const spanish = voices.filter((v) => v.lang.toLowerCase().startsWith('es'));
  if (spanish.length === 0) return null;
  const latam = spanish.find((v) => /es[-_](ar|mx|cl|co|pe|us|419)/i.test(v.lang));
  return latam ?? spanish[0] ?? null;
}

export const webSpeechProvider: SpeechProvider = {
  isAvailable: () => speechApi() !== null,

  synthesize(request, events = {}) {
    const synth = speechApi();
    const segments = parseSsml(request.ssml);
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    if (!synth) {
      events.onError?.('Este navegador no tiene síntesis de voz.');
      return { stop: () => {}, isRunning: () => false };
    }

    const voice = preferredVoice(synth.getVoices());

    const step = (index: number) => {
      if (stopped) return;
      const segment = segments[index];
      if (!segment) {
        events.onDone?.();
        return;
      }

      events.onSegment?.(index, segments.length, segment);

      if (segment.kind === 'pause') {
        timer = setTimeout(() => step(index + 1), segment.ms);
        return;
      }

      const utterance = new SpeechSynthesisUtterance(segment.text);
      utterance.rate = segment.rate;
      utterance.volume = request.volume();
      utterance.lang = voice?.lang ?? 'es-AR';
      if (voice) utterance.voice = voice;
      utterance.onend = () => step(index + 1);
      utterance.onerror = () => {
        // A single failed utterance should not end the practice; carrying on
        // loses a sentence, stopping loses the session.
        if (!stopped) step(index + 1);
      };
      synth.speak(utterance);
    };

    // Chrome keeps a queue across pages. Anything left over would speak on top
    // of this one.
    synth.cancel();
    step(0);

    return {
      stop: () => {
        stopped = true;
        if (timer) clearTimeout(timer);
        synth.cancel();
      },
      isRunning: () => !stopped,
    };
  },
};
