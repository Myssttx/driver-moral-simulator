import { SCENARIOS } from "./scenarios";

/**
 * Canonical participant run order.
 *
 * This list is intentionally fixed and must not be shuffled per participant:
 * round 1 is always scenario 1, round 2 is always scenario 2, and so on.
 * The scenario file is authored in four increasing-difficulty blocks of five.
 */
export const CANONICAL_SCENARIO_IDS = [
  1, 2, 3, 4, 5,
  6, 7, 8, 9, 10,
  11, 12, 13, 14, 15,
  16, 17, 18, 19, 20,
];

const scenariosById = new Map(SCENARIOS.map((scenario) => [scenario.id, scenario]));

export const ORDERED_SCENARIOS = CANONICAL_SCENARIO_IDS.map((id) => {
  const scenario = scenariosById.get(id);
  if (!scenario) {
    throw new Error(`Canonical run order references missing scenario ${id}`);
  }
  return scenario;
});

if (new Set(CANONICAL_SCENARIO_IDS).size !== CANONICAL_SCENARIO_IDS.length) {
  throw new Error("Canonical run order contains duplicate scenario ids");
}
