import { play, setEnabled, type SoundName } from "cuelume";

const SOUND_ENABLED_STORAGE_KEY = "edge:sound-enabled";

export function readSoundEnabled() {
  if (typeof window === "undefined") return true;

  try {
    return window.localStorage.getItem(SOUND_ENABLED_STORAGE_KEY) !== "false";
  } catch {
    return true;
  }
}

export function initializeSoundEnabled() {
  const enabled = readSoundEnabled();
  setEnabled(enabled);
  return enabled;
}

export function setSoundEnabled(enabled: boolean) {
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

  setEnabled(enabled);
}

export function playEdgeSound(sound: SoundName) {
  if (!readSoundEnabled()) return;

  // Keep Cuelume synchronized even if this is the first sound after a reload.
  setEnabled(true);
  play(sound);
}