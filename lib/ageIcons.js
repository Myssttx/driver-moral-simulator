/** Map numeric age to required emoji category. */
export function iconForAge(age) {
  if (age < 18) return "👶";
  if (age >= 65) return "🧓";
  return "🧑";
}

/** Cartoon figure variant for crosswalk visualization. */
export function variantForAge(age) {
  if (age < 18) return "child";
  if (age >= 65) return "elder";
  return "adult";
}

export function summarizeAges(ages) {
  return ages.map(iconForAge);
}
