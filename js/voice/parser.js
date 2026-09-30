const NUMBER_WORDS = new Map([
  ["zero", 0], ["one", 1], ["two", 2], ["three", 3], ["four", 4],
  ["five", 5], ["six", 6], ["seven", 7], ["eight", 8], ["nine", 9],
  ["ten", 10], ["eleven", 11], ["twelve", 12]
]);

function spokenNumber(token) {
  if (token == null) return null;
  const normalized = String(token).toLowerCase().trim();
  if (/^\d+(?:\.\d+)?$/.test(normalized)) return Number(normalized);
  return NUMBER_WORDS.get(normalized) ?? null;
}

function firstNumber(text, pattern) {
  const match = text.match(pattern);
  if (!match) return null;
  return spokenNumber(match[1]);
}

function mapThreeLevel(text, word) {
  const aliases = {
    low: "2",
    poor: "2",
    bad: "2",
    medium: "3",
    average: "3",
    okay: "3",
    ok: "3",
    high: "4",
    good: "4"
  };

  const match = text.match(
    new RegExp("\\b(low|poor|bad|medium|average|okay|ok|high|good)\\s+" + word + "\\b", "i")
  );
  if (!match) return null;
  return aliases[match[1].toLowerCase()];
}

function workoutType(text) {
  if (/\b(bjj|jiu[- ]?jitsu|jiujitsu)\b/i.test(text)) return "BJJ";
  if (/\b(strength|lifting|weights|weight training)\b/i.test(text)) return "Strength";
  if (/\b(cardio|running|run|cycling|bike|biking)\b/i.test(text)) return "Cardio";
  if (/\b(walk|walking|hike|hiking)\b/i.test(text)) return "Walking / Hiking";
  if (/\b(mobility|stretching|stretch)\b/i.test(text)) return "Mobility";
  return null;
}

function intensity(text) {
  const match = text.match(
    /\b(very\s+high|high|medium|low)\s+intensity\b|\b(very\s+hard|hard|moderate|easy)(?:\s+(?:intensity|workout|session))?\b/i
  );
  if (!match) return null;

  const value = (match[1] ?? match[2]).toLowerCase().replace(/\s+/g, " ");
  return ({
    low: "Easy",
    easy: "Easy",
    medium: "Moderate",
    moderate: "Moderate",
    high: "Hard",
    hard: "Hard",
    "very high": "Very Hard",
    "very hard": "Very Hard"
  })[value];
}

function durationMinutes(text) {
  const minutes = firstNumber(text, /\b(?:for\s+)?(\d+(?:\.\d+)?|zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s*(?:minutes?|mins?)\b/i);
  if (minutes != null) return Math.round(minutes);

  const hours = firstNumber(text, /\b(?:for\s+)?(\d+(?:\.\d+)?|zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s*(?:hours?|hrs?)\b/i);
  if (hours != null) return Math.round(hours * 60);
  return null;
}

function dateForText(text, now) {
  const date = new Date(now);
  if (/\byesterday\b/i.test(text)) date.setDate(date.getDate() - 1);
  return date.toISOString();
}

export function parseVoiceTranscript(transcript, now = new Date()) {
  const text = String(transcript ?? "").trim();
  const drafts = [];
  if (!text) return drafts;

  const datetime = dateForText(text, now);

  const sleepHours = firstNumber(
    text,
    /\b(?:slept(?:\s+for|\s+about)?|was\s+(?:asleep|sleeping)\s+for)\s+(\d+(?:\.\d+)?|zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s*(?:hours?|hrs?)\b/i
  );
  const sleepQuality = mapThreeLevel(text, "quality");
  const energy = mapThreeLevel(text, "energy");

  if (sleepHours != null || sleepQuality || energy) {
    drafts.push({
      type: "daily",
      datetime,
      fields: {
        sleep_hours: sleepHours == null ? "" : String(sleepHours),
        sleep_quality: sleepQuality ?? "",
        energy: energy ?? "",
        notes: ""
      }
    });
  }

  const weight = firstNumber(
    text,
    /\b(?:weigh(?:ing)?(?:\s+about|\s+at)?|weight(?:\s+is|\s+about)?)\s+(\d+(?:\.\d+)?|zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b/i
  );
  const waist = firstNumber(
    text,
    /\bwaist(?:\s+(?:is|about|coming\s+in\s+at))?\s+(\d+(?:\.\d+)?|zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b/i
  );

  if (weight != null || waist != null) {
    drafts.push({
      type: "measurement",
      datetime,
      fields: {
        weight_lb: weight == null ? "" : String(weight),
        waist_in: waist == null ? "" : String(waist)
      }
    });
  }

  const bp = text.match(/\b(?:bp|blood\s+press(?:ure|ue))(?:\s+(?:is|about))?\s*(\d{2,3})\s*(?:over|\/)\s*(\d{2,3})\b/i);
  const pulse = firstNumber(
    text,
    /\b(?:pulse|bpm)(?:\s+is|\s+about|\s+is\s+about)?\s+(\d{2,3})\b/i
  );

  if (bp || pulse != null) {
    drafts.push({
      type: "bp",
      datetime,
      fields: {
        systolic: bp?.[1] ?? "",
        diastolic: bp?.[2] ?? "",
        pulse: pulse == null ? "" : String(pulse)
      }
    });
  }

  const type = workoutType(text);
  const workoutMinutes = type ? durationMinutes(text) : null;
  const workoutIntensity = type ? intensity(text) : null;

  if (type) {
    drafts.push({
      type: "workout",
      datetime,
      fields: {
        workout_type: type,
        duration_min: workoutMinutes == null ? "" : String(workoutMinutes),
        intensity: workoutIntensity ?? "",
        notes: ""
      }
    });
  }

  return drafts;
}

export function missingRequiredFields(draft) {
  const required = {
    daily: ["sleep_hours", "sleep_quality", "energy"],
    measurement: ["weight_lb"],
    bp: ["systolic", "diastolic", "pulse"],
    workout: ["workout_type", "duration_min", "intensity"]
  };

  return (required[draft.type] ?? []).filter(name => {
    const value = draft.fields?.[name];
    return value == null || String(value).trim() === "";
  });
}
