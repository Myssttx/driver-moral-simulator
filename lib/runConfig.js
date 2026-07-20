/**
 * Standardized run parameters for every participant.
 *
 * These constants govern every timing-relevant aspect of a session. They are
 * intentionally consolidated here so that researchers can audit the protocol
 * (and so any change is git-tracked in a single, obvious place).
 *
 * Standardization invariants enforced elsewhere:
 *   - Scenario order is fixed by CANONICAL_SCENARIO_IDS in data/runOrder.js.
 *   - Pedestrian sprites/positions/labels are derived deterministically from
 *     scenario data (see lib/roles.js, lib/referenceSprites.js, lib/ageIcons.js).
 *   - No animations vary between participants (no random bobbing, jitter, etc).
 *   - The result popup shows only "Decision recorded" + choice — no reaction
 *     time or comparison data shown to participants.
 */

/** Seconds a participant has to choose per scenario. */
export const SCENARIO_TIMEOUT_S = 15;

/** Milliseconds the result popup stays on screen after a decision. */
export const RESULT_VISIBLE_MS = 2400;

/** Milliseconds of blank gap between scenarios. */
export const BETWEEN_SCENARIOS_MS = 1000;

/** Total scenarios in a run. */
export const TOTAL_SCENARIOS = 20;
