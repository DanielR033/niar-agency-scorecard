import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadInstrument } from "../src/instrument.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const raw = JSON.parse(
  readFileSync(join(__dirname, "..", "src", "questions.json"), "utf8")
);

export const instrument = loadInstrument(raw);

const ALL_C_ITEMS = ["C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8", "C9", "C10", "C11", "C12", "C13", "C14", "C15", "C16"];

// Builds a respondent with every Block C item defaulted to `baseline`,
// overridden per-item by `overrides`, plus any Block B/other answers.
export function respondent({ id, roleBand, baseline = 3, overrides = {}, answers = {} }) {
  const cAnswers = {};
  for (const item of ALL_C_ITEMS) {
    cAnswers[item] = overrides[item] ?? baseline;
  }
  return { id, roleBand, answers: { ...cAnswers, ...answers } };
}
