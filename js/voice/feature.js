const VOICE_FLAG_KEY = "healthtracker.voiceExperiment";

export function voiceExperimentEnabled() {
  return localStorage.getItem(VOICE_FLAG_KEY) === "1";
}

export function applyVoiceExperimentFlag(url = new URL(window.location.href)) {
  const value = url.searchParams.get("voiceTest");
  if (value === "1") localStorage.setItem(VOICE_FLAG_KEY, "1");
  if (value === "0") localStorage.removeItem(VOICE_FLAG_KEY);

  if (value != null) {
    url.searchParams.delete("voiceTest");
    history.replaceState(null, "", url.pathname + url.search + url.hash);
  }

  return voiceExperimentEnabled();
}
