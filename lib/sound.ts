type EdgeSoundName = "sparkle" | "error";

type ToneLayer = {
  kind: "tone";
  waveform: OscillatorType;
  frequency: number;
  offset?: number;
  attack: number;
  decay: number;
  peak: number;
};

type NoiseLayer = {
  kind: "noise";
  filterType: BiquadFilterType;
  filterFrequency: number;
  filterQ?: number;
  offset?: number;
  attack: number;
  decay: number;
  peak: number;
};

type SoundLayer = ToneLayer | NoiseLayer;

type Shimmer = {
  delay: number;
  feedback: number;
  wet: number;
  lowpass: number;
};

type SoundRecipe = {
  masterGain: number;
  layers: SoundLayer[];
  shimmer?: Shimmer;
};

type AudioContextWindow = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };

const SOUND_ENABLED_STORAGE_KEY = "edge:sound-enabled";
const SOURCE_STOP_PADDING = 0.05;
const CLEANUP_MARGIN = 0.05;
const INAUDIBLE_GAIN = 0.001;

// These are the exact Cuelume 0.1.2 sparkle and error recipes. Keeping the
// shared AudioContext here lets us unlock the same context during the user's
// initial phone press, before the async bet request finishes.
const RECIPES: Record<EdgeSoundName, SoundRecipe> = {
  sparkle: {
    masterGain: 0.5,
    layers: [
      {
        kind: "tone",
        waveform: "sine",
        frequency: 1760,
        offset: 0,
        attack: 0.003,
        decay: 0.09,
        peak: 0.045,
      },
      {
        kind: "tone",
        waveform: "sine",
        frequency: 2217,
        offset: 0.045,
        attack: 0.003,
        decay: 0.09,
        peak: 0.04,
      },
      {
        kind: "tone",
        waveform: "sine",
        frequency: 2637,
        offset: 0.09,
        attack: 0.003,
        decay: 0.1,
        peak: 0.038,
      },
      {
        kind: "tone",
        waveform: "sine",
        frequency: 3520,
        offset: 0.135,
        attack: 0.003,
        decay: 0.12,
        peak: 0.032,
      },
    ],
    shimmer: {
      delay: 0.07,
      feedback: 0.35,
      wet: 0.22,
      lowpass: 6000,
    },
  },
  error: {
    masterGain: 0.42,
    layers: [
      {
        kind: "noise",
        filterType: "bandpass",
        filterFrequency: 850,
        filterQ: 1.1,
        attack: 0.001,
        decay: 0.035,
        peak: 0.13,
      },
      {
        kind: "tone",
        waveform: "triangle",
        frequency: 440,
        offset: 0.025,
        attack: 0.004,
        decay: 0.09,
        peak: 0.045,
      },
      {
        kind: "tone",
        waveform: "triangle",
        frequency: 349.23,
        offset: 0.1,
        attack: 0.004,
        decay: 0.14,
        peak: 0.04,
      },
    ],
  },
};

let sharedContext: AudioContext | null = null;
let soundEnabled = true;
let unlockPromise: Promise<void> | null = null;

function getAudioContext() {
  if (typeof window === "undefined") return null;

  if (sharedContext?.state === "closed") {
    sharedContext = null;
  }

  if (sharedContext) return sharedContext;

  const audioWindow = window as AudioContextWindow;
  const AudioContextConstructor =
    audioWindow.AudioContext ?? audioWindow.webkitAudioContext;

  if (!AudioContextConstructor) return null;

  try {
    sharedContext = new AudioContextConstructor();
    return sharedContext;
  } catch {
    return null;
  }
}

function primeAudioContext(context: AudioContext) {
  try {
    const buffer = context.createBuffer(1, 1, context.sampleRate);
    const source = context.createBufferSource();

    source.buffer = buffer;
    source.connect(context.destination);
    source.onended = () => source.disconnect();
    source.start();
  } catch {
    // Some browsers do not need the silent source. Resuming is still attempted.
  }
}

function renderTone(
  context: AudioContext,
  destination: AudioNode,
  layer: ToneLayer,
  startTime: number,
) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.type = layer.waveform;
  oscillator.frequency.setValueAtTime(layer.frequency, startTime);

  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.exponentialRampToValueAtTime(
    layer.peak,
    startTime + layer.attack,
  );
  gain.gain.exponentialRampToValueAtTime(
    0.0001,
    startTime + layer.attack + layer.decay,
  );

  oscillator.connect(gain).connect(destination);
  oscillator.start(startTime);
  oscillator.stop(
    startTime + layer.attack + layer.decay + SOURCE_STOP_PADDING,
  );
}

function renderNoise(
  context: AudioContext,
  destination: AudioNode,
  layer: NoiseLayer,
  startTime: number,
) {
  const duration = layer.attack + layer.decay + SOURCE_STOP_PADDING;
  const length = Math.max(1, Math.floor(duration * context.sampleRate));
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);

  for (let index = 0; index < data.length; index += 1) {
    data[index] = 2 * Math.random() - 1;
  }

  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();

  source.buffer = buffer;
  filter.type = layer.filterType;
  filter.frequency.value = layer.filterFrequency;

  if (layer.filterQ !== undefined) {
    filter.Q.value = layer.filterQ;
  }

  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.exponentialRampToValueAtTime(
    layer.peak,
    startTime + layer.attack,
  );
  gain.gain.exponentialRampToValueAtTime(
    0.0001,
    startTime + layer.attack + layer.decay,
  );

  source.connect(filter).connect(gain).connect(destination);
  source.start(startTime);
  source.stop(startTime + duration);
}

function attachShimmer(
  context: AudioContext,
  source: AudioNode,
  destination: AudioNode,
  shimmer: Shimmer,
) {
  const delay = context.createDelay(1);
  const feedbackFilter = context.createBiquadFilter();
  const feedbackGain = context.createGain();
  const wetGain = context.createGain();

  delay.delayTime.value = shimmer.delay;
  feedbackFilter.type = "lowpass";
  feedbackFilter.frequency.value = shimmer.lowpass;
  feedbackGain.gain.value = shimmer.feedback;
  wetGain.gain.value = shimmer.wet;

  source.connect(delay);
  delay.connect(feedbackFilter);
  feedbackFilter.connect(feedbackGain);
  feedbackGain.connect(delay);
  feedbackFilter.connect(wetGain);
  wetGain.connect(destination);

  return [delay, feedbackFilter, feedbackGain, wetGain];
}

function getSourceEnd(recipe: SoundRecipe) {
  return Math.max(
    ...recipe.layers.map(
      (layer) =>
        (layer.offset ?? 0) +
        layer.attack +
        layer.decay +
        SOURCE_STOP_PADDING,
    ),
  );
}

function getShimmerTail(shimmer?: Shimmer) {
  if (!shimmer || shimmer.feedback <= 0) return 0;
  if (shimmer.feedback >= 1) return shimmer.delay;

  return (
    shimmer.delay *
    (1 + Math.ceil(Math.log(INAUDIBLE_GAIN) / Math.log(shimmer.feedback)))
  );
}

function renderRecipe(context: AudioContext, recipe: SoundRecipe) {
  const now = context.currentTime;
  const master = context.createGain();

  master.gain.value = recipe.masterGain;
  master.connect(context.destination);

  const shimmerNodes = recipe.shimmer
    ? attachShimmer(context, master, context.destination, recipe.shimmer)
    : [];

  for (const layer of recipe.layers) {
    const startTime = now + (layer.offset ?? 0);

    if (layer.kind === "tone") {
      renderTone(context, master, layer, startTime);
    } else {
      renderNoise(context, master, layer, startTime);
    }
  }

  const cleanupAfterMs =
    (getSourceEnd(recipe) +
      getShimmerTail(recipe.shimmer) +
      CLEANUP_MARGIN) *
    1000;

  window.setTimeout(() => {
    try {
      master.disconnect();

      for (const node of shimmerNodes) {
        node.disconnect();
      }
    } catch {
      // Nodes may already be disconnected during navigation or teardown.
    }
  }, cleanupAfterMs);
}

export function readSoundEnabled() {
  if (typeof window === "undefined") return true;

  try {
    return window.localStorage.getItem(SOUND_ENABLED_STORAGE_KEY) !== "false";
  } catch {
    return true;
  }
}

export function initializeSoundEnabled() {
  soundEnabled = readSoundEnabled();
  return soundEnabled;
}

export function setSoundEnabled(enabled: boolean) {
  soundEnabled = enabled;

  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(
        SOUND_ENABLED_STORAGE_KEY,
        enabled ? "true" : "false",
      );
    } catch {
      // Keep the in-memory preference working when storage is unavailable.
    }
  }
}

/**
 * Call this directly from pointerdown/touchstart. Mobile Safari requires the
 * AudioContext to be created and resumed during the original user gesture.
 */
export async function unlockEdgeSound() {
  if (!soundEnabled || !readSoundEnabled()) return;

  const context = getAudioContext();
  if (!context) return;

  primeAudioContext(context);

  if (context.state === "running") return;

  if (!unlockPromise) {
    unlockPromise = context
      .resume()
      .then(() => {
        primeAudioContext(context);
      })
      .catch(() => {
        // Audio remains unavailable until a later user gesture retries it.
      })
      .finally(() => {
        unlockPromise = null;
      });
  }

  await unlockPromise;
}

export function playEdgeSound(sound: EdgeSoundName) {
  if (!soundEnabled || !readSoundEnabled()) return;

  const context = getAudioContext();
  if (!context) return;

  const playNow = () => {
    if (soundEnabled && readSoundEnabled() && context.state === "running") {
      renderRecipe(context, RECIPES[sound]);
    }
  };

  if (context.state === "running") {
    playNow();
    return;
  }

  try {
    void context.resume().then(playNow).catch(() => {
      // Mobile browsers can reject this when no prior gesture unlocked audio.
    });
  } catch {
    // Some browsers throw synchronously when playback is blocked.
  }
}