import test from "node:test";
import assert from "node:assert/strict";
import { parseVoiceTranscript, missingRequiredFields } from "../js/voice/parser.js";

const NOW = new Date("2026-09-30T12:00:00-04:00");

test("parses natural sleep phrases and relative date", () => {
  const [draft] = parseVoiceTranscript("Yesterday I slept six hours, low quality, medium energy", NOW);
  assert.equal(draft.type, "daily");
  assert.equal(draft.fields.sleep_hours, "6");
  assert.equal(draft.fields.sleep_quality, "2");
  assert.equal(draft.fields.energy, "3");
  assert.equal(new Date(draft.datetime).getDate(), 29);
});

test("parses weight and waist variants", () => {
  const [draft] = parseVoiceTranscript("I am weighing about 198.6, waist coming in at 36.5", NOW);
  assert.equal(draft.type, "measurement");
  assert.equal(draft.fields.weight_lb, "198.6");
  assert.equal(draft.fields.waist_in, "36.5");
});

test("parses blood pressure and pulse", () => {
  const [draft] = parseVoiceTranscript("BP about 132 over 78 and BPM is about 64", NOW);
  assert.equal(draft.type, "bp");
  assert.equal(draft.fields.systolic, "132");
  assert.equal(draft.fields.diastolic, "78");
  assert.equal(draft.fields.pulse, "64");
});

test("accepts common blood pressure misspelling", () => {
  const [draft] = parseVoiceTranscript("Blood pressue is 140 over 80. Pulse is 70", NOW);
  assert.equal(draft.type, "bp");
  assert.equal(draft.fields.systolic, "140");
  assert.equal(draft.fields.diastolic, "80");
  assert.equal(draft.fields.pulse, "70");
});

test("parses BJJ workout duration and intensity", () => {
  const [draft] = parseVoiceTranscript("Did BJJ for 75 minutes, hard intensity", NOW);
  assert.equal(draft.type, "workout");
  assert.equal(draft.fields.workout_type, "BJJ");
  assert.equal(draft.fields.duration_min, "75");
  assert.equal(draft.fields.intensity, "Hard");
});

test("one transcript can produce multiple draft records", () => {
  const drafts = parseVoiceTranscript("I slept 7 hours, high quality, medium energy. Weighing at 199. BP 128 over 76 and pulse is 62.", NOW);
  assert.deepEqual(drafts.map(draft => draft.type), ["daily", "measurement", "bp"]);
});

test("missing required fields are surfaced instead of guessed", () => {
  const [draft] = parseVoiceTranscript("Yesterday I slept six hours", NOW);
  assert.deepEqual(missingRequiredFields(draft), ["sleep_quality", "energy"]);
});


test("parses good quality and high intensity from natural speech", () => {
  const drafts = parseVoiceTranscript(
    "Slept about six hours yesterday, good quality, low energy. Did BJJ for 75 minutes high intensity.",
    NOW
  );

  assert.equal(drafts[0].type, "daily");
  assert.equal(drafts[0].fields.sleep_hours, "6");
  assert.equal(drafts[0].fields.sleep_quality, "4");
  assert.equal(drafts[0].fields.energy, "2");

  assert.equal(drafts[1].type, "workout");
  assert.equal(drafts[1].fields.workout_type, "BJJ");
  assert.equal(drafts[1].fields.duration_min, "75");
  assert.equal(drafts[1].fields.intensity, "Hard");
  assert.deepEqual(missingRequiredFields(drafts[0]), []);
  assert.deepEqual(missingRequiredFields(drafts[1]), []);
});
