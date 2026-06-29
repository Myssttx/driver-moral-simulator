/**
 * 20 trolley-style road scenarios, ordered by ascending cognitive difficulty.
 * Difficulty escalates in 4 tiers of 5 scenarios each.
 *
 * LEFT = swerve left (impact left group). RIGHT = stay course (impact right group).
 * `roles` parallels `ages` (outfit / citizen type). Optional `kinds` parallels `ages`:
 * `human` (default), `dog`, or `cat`.
 *
 * Count gap is held tight throughout (max difference of 2) so difficulty is
 * driven by which *variables* are in play, not by easy numerical heuristics.
 *
 *   SET 1 (1-5)   Baseline       Count diff 1-2; all legal, adults, no pets.
 *                                Mild utilitarian lean. EEG baseline.
 *   SET 2 (6-10)  +Legality/Age  Jaywalking + child/elder introduced.
 *                                Rule-vs-outcome tension.
 *   SET 3 (11-15) +Roles/Pets    Counts within 1 (often equal). Roles and
 *                                pets force qualitative weighting.
 *   SET 4 (16-20) Max dilemma    Equal counts. Every variable active. No
 *                                simple heuristic — peak deliberation.
 */
export const SCENARIOS = [
  // ── SET 1: BASELINE ──────────────────────────────────────────────
  // Pure count asymmetry. All legal, all adult, no pets, neutral roles.
  // Max count gap = 2.
  {
    id: 1,
    left: { count: 1, ages: [35], legal: true, roles: ["casual"] },
    right: {
      count: 3,
      ages: [30, 36, 40],
      legal: true,
      roles: ["casual", "casual", "casual"],
    },
  },
  {
    id: 2,
    left: {
      count: 3,
      ages: [28, 34, 42],
      legal: true,
      roles: ["casual", "casual", "casual"],
    },
    right: { count: 1, ages: [33], legal: true, roles: ["casual"] },
  },
  {
    id: 3,
    left: { count: 2, ages: [37, 41], legal: true, roles: ["casual", "casual"] },
    right: {
      count: 3,
      ages: [25, 35, 45],
      legal: true,
      roles: ["casual", "casual", "casual"],
    },
  },
  {
    id: 4,
    left: { count: 1, ages: [36], legal: true, roles: ["casual"] },
    right: { count: 2, ages: [29, 33], legal: true, roles: ["casual", "casual"] },
  },
  {
    id: 5,
    left: {
      count: 3,
      ages: [27, 32, 39],
      legal: true,
      roles: ["casual", "casual", "casual"],
    },
    right: { count: 2, ages: [40, 45], legal: true, roles: ["casual", "casual"] },
  },

  // ── SET 2: + LEGALITY & AGE EXTREMES ─────────────────────────────
  // Same count range. Jaywalking + children/elders introduced.
  {
    id: 6,
    left: { count: 2, ages: [30, 38], legal: true, roles: ["casual", "casual"] },
    right: {
      count: 3,
      ages: [27, 31, 35],
      legal: false,
      roles: ["casual", "casual", "casual"],
    },
  },
  {
    id: 7,
    left: { count: 1, ages: [38], legal: true, roles: ["professional"] },
    right: {
      count: 2,
      ages: [7, 9],
      legal: true,
      roles: ["student", "student"],
    },
  },
  {
    id: 8,
    left: {
      count: 3,
      ages: [72, 76, 81],
      legal: true,
      roles: ["casual", "casual", "casual"],
    },
    right: {
      count: 2,
      ages: [28, 33],
      legal: false,
      roles: ["casual", "casual"],
    },
  },
  {
    id: 9,
    left: { count: 1, ages: [70], legal: true, roles: ["medical"] },
    right: {
      count: 3,
      ages: [16, 17, 18],
      legal: false,
      roles: ["student", "student", "student"],
    },
  },
  {
    id: 10,
    left: {
      count: 2,
      ages: [6, 8],
      legal: true,
      roles: ["student", "student"],
    },
    right: {
      count: 3,
      ages: [40, 42, 45],
      legal: true,
      roles: ["casual", "professional", "casual"],
    },
  },

  // ── SET 3: + ROLES & PETS, CLOSER COUNTS ─────────────────────────
  // Counts within 1 (some equal). Roles and pets force qualitative weighting.
  {
    id: 11,
    left: { count: 2, ages: [34, 38], legal: true, roles: ["medical", "medical"] },
    right: { count: 2, ages: [40, 45], legal: true, roles: ["worker", "worker"] },
  },
  {
    id: 12,
    left: {
      count: 3,
      ages: [9, 11, 5],
      legal: true,
      roles: ["student", "student", "casual"],
      kinds: ["human", "human", "dog"],
    },
    right: {
      count: 2,
      ages: [42, 47],
      legal: true,
      roles: ["professional", "professional"],
    },
  },
  {
    id: 13,
    left: {
      count: 2,
      ages: [10, 8],
      legal: true,
      roles: ["student", "casual"],
      kinds: ["human", "cat"],
    },
    right: {
      count: 3,
      ages: [30, 50, 60],
      legal: true,
      roles: ["casual", "casual", "casual"],
    },
  },
  {
    id: 14,
    left: {
      count: 3,
      ages: [30, 35, 65],
      legal: true,
      roles: ["casual", "professional", "casual"],
    },
    right: {
      count: 3,
      ages: [25, 35, 50],
      legal: false,
      roles: ["casual", "athlete", "casual"],
    },
  },
  {
    id: 15,
    left: { count: 2, ages: [68, 72], legal: true, roles: ["medical", "medical"] },
    right: { count: 2, ages: [22, 24], legal: true, roles: ["athlete", "athlete"] },
  },

  // ── SET 4: MAXIMUM DILEMMA ───────────────────────────────────────
  // Equal counts. Every variable active. Forces full deliberation.
  {
    id: 16,
    left: { count: 1, ages: [7], legal: true, roles: ["student"] },
    right: { count: 1, ages: [78], legal: true, roles: ["medical"] },
  },
  {
    id: 17,
    left: {
      count: 2,
      ages: [9, 11],
      legal: true,
      roles: ["student", "student"],
    },
    right: {
      count: 2,
      ages: [30, 35],
      legal: false,
      roles: ["professional", "professional"],
    },
  },
  {
    id: 18,
    left: {
      count: 3,
      ages: [8, 30, 6],
      legal: true,
      roles: ["student", "casual", "casual"],
      kinds: ["human", "human", "dog"],
    },
    right: {
      count: 3,
      ages: [28, 33, 38],
      legal: false,
      roles: ["worker", "athlete", "professional"],
    },
  },
  {
    id: 19,
    left: {
      count: 3,
      ages: [25, 45, 55],
      legal: true,
      roles: ["professional", "medical", "worker"],
    },
    right: {
      count: 3,
      ages: [22, 30, 50],
      legal: true,
      roles: ["athlete", "student", "casual"],
    },
  },
  {
    id: 20,
    left: { count: 2, ages: [40, 42], legal: true, roles: ["medical", "medical"] },
    right: { count: 2, ages: [38, 44], legal: true, roles: ["casual", "casual"] },
  },
];
