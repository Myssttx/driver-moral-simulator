/**
 * 20 preloaded trolley-style road scenarios.
 * LEFT = swerve left (impact left group). RIGHT = stay course (impact right group).
 * `roles` parallels `ages` (outfit / citizen type). Optional `kinds` parallels `ages`:
 * `human` (default), `dog`, or `cat` for leashed-style pets in the crosswalk.
 */
export const SCENARIOS = [
  {
    id: 1,
    left: {
      count: 2,
      ages: [6, 9],
      legal: true,
      roles: ["student", "casual"],
      kinds: ["human", "dog"],
    },
    right: { count: 1, ages: [42], legal: true, roles: ["professional"] },
  },
  {
    id: 2,
    left: { count: 1, ages: [78], legal: true, roles: ["casual"] },
    right: {
      count: 3,
      ages: [28, 31, 35],
      legal: true,
      roles: ["professional", "casual", "professional"],
      kinds: ["human", "cat", "human"],
    },
  },
  {
    id: 3,
    left: {
      count: 4,
      ages: [12, 14, 16, 19],
      legal: false,
      roles: ["student", "student", "athlete", "casual"],
      kinds: ["human", "dog", "human", "human"],
    },
    right: { count: 2, ages: [55, 62], legal: true, roles: ["casual", "medical"] },
  },
  {
    id: 4,
    left: { count: 1, ages: [34], legal: true, roles: ["worker"] },
    right: {
      count: 5,
      ages: [4, 5, 7, 8, 9],
      legal: true,
      roles: ["casual", "casual", "student", "student", "casual"],
      kinds: ["human", "human", "human", "human", "dog"],
    },
  },
  {
    id: 5,
    left: {
      count: 3,
      ages: [71, 74, 80],
      legal: true,
      roles: ["casual", "medical", "casual"],
      kinds: ["human", "human", "cat"],
    },
    right: { count: 2, ages: [22, 26], legal: false, roles: ["athlete", "student"] },
  },
  {
    id: 6,
    left: { count: 2, ages: [45, 48], legal: true, roles: ["professional", "professional"] },
    right: {
      count: 2,
      ages: [38, 41],
      legal: true,
      roles: ["casual", "worker"],
      kinds: ["cat", "human"],
    },
  },
  {
    id: 7,
    left: { count: 1, ages: [8], legal: true, roles: ["student"] },
    right: {
      count: 4,
      ages: [67, 69, 72, 75],
      legal: true,
      roles: ["casual", "casual", "professional", "casual"],
      kinds: ["human", "dog", "human", "human"],
    },
  },
  {
    id: 8,
    left: {
      count: 6,
      ages: [25, 27, 29, 30, 32, 33],
      legal: false,
      roles: ["worker", "casual", "athlete", "professional", "student", "casual"],
      kinds: ["dog", "human", "human", "human", "human", "human"],
    },
    right: { count: 1, ages: [90], legal: true, roles: ["casual"] },
  },
  {
    id: 9,
    left: {
      count: 2,
      ages: [3, 5],
      legal: true,
      roles: ["casual", "casual"],
      kinds: ["human", "cat"],
    },
    right: {
      count: 3,
      ages: [52, 54, 58],
      legal: true,
      roles: ["professional", "medical", "worker"],
    },
  },
  {
    id: 10,
    left: { count: 3, ages: [19, 21, 24], legal: true, roles: ["student", "athlete", "casual"] },
    right: {
      count: 3,
      ages: [19, 22, 23],
      legal: false,
      roles: ["professional", "student", "casual"],
    },
  },
  {
    id: 11,
    left: { count: 1, ages: [61], legal: true, roles: ["professional"] },
    right: {
      count: 2,
      ages: [11, 13],
      legal: true,
      roles: ["student", "casual"],
      kinds: ["human", "dog"],
    },
  },
  {
    id: 12,
    left: {
      count: 4,
      ages: [40, 42, 44, 46],
      legal: true,
      roles: ["professional", "professional", "casual", "professional"],
    },
    right: { count: 1, ages: [17], legal: false, roles: ["student"] },
  },
  {
    id: 13,
    left: {
      count: 2,
      ages: [86, 88],
      legal: true,
      roles: ["casual", "professional"],
      kinds: ["human", "cat"],
    },
    right: { count: 2, ages: [20, 22], legal: true, roles: ["athlete", "athlete"] },
  },
  {
    id: 14,
    left: { count: 1, ages: [36], legal: false, roles: ["worker"] },
    right: {
      count: 4,
      ages: [6, 7, 9, 10],
      legal: true,
      roles: ["casual", "student", "student", "casual"],
      kinds: ["human", "cat", "human", "human"],
    },
  },
  {
    id: 15,
    left: {
      count: 5,
      ages: [18, 19, 20, 21, 22],
      legal: false,
      roles: ["student", "casual", "athlete", "student", "casual"],
      kinds: ["dog", "human", "human", "human", "human"],
    },
    right: { count: 2, ages: [63, 66], legal: true, roles: ["casual", "casual"] },
  },
  {
    id: 16,
    left: { count: 2, ages: [50, 52], legal: true, roles: ["professional", "medical"] },
    right: { count: 2, ages: [50, 51], legal: true, roles: ["worker", "professional"] },
  },
  {
    id: 17,
    left: {
      count: 3,
      ages: [2, 4, 6],
      legal: true,
      roles: ["casual", "casual", "student"],
      kinds: ["human", "dog", "human"],
    },
    right: { count: 1, ages: [44], legal: true, roles: ["professional"] },
  },
  {
    id: 18,
    left: { count: 1, ages: [29], legal: true, roles: ["medical"] },
    right: {
      count: 7,
      ages: [30, 31, 32, 33, 34, 35, 36],
      legal: false,
      roles: [
        "professional",
        "professional",
        "casual",
        "professional",
        "worker",
        "professional",
        "casual",
      ],
      kinds: ["human", "human", "human", "cat", "human", "human", "human"],
    },
  },
  {
    id: 19,
    left: { count: 2, ages: [76, 79], legal: true, roles: ["casual", "medical"] },
    right: {
      count: 3,
      ages: [15, 16, 17],
      legal: true,
      roles: ["student", "athlete", "student"],
      kinds: ["human", "cat", "human"],
    },
  },
  {
    id: 20,
    left: {
      count: 4,
      ages: [10, 12, 65, 68],
      legal: true,
      roles: ["student", "student", "casual", "casual"],
      kinds: ["human", "dog", "human", "human"],
    },
    right: {
      count: 4,
      ages: [25, 28, 70, 73],
      legal: true,
      roles: ["professional", "athlete", "casual", "medical"],
    },
  },
];
