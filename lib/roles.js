/** Short HUD label under figures in the windshield view (readable names, not jargon). */
export const ROLE_SHORT = {
  professional: "Professional",
  medical: "Medical",
  worker: "Construction worker",
  student: "Student",
  athlete: "Athlete",
  casual: "Citizen",
};

/** Visual / narrative role for pedestrians (matches `roles[]` in scenarios). */
export const ROLE_LABELS = {
  casual: "Citizen",
  professional: "Professional",
  athlete: "Athlete",
  medical: "Medical",
  worker: "Construction worker",
  student: "Student",
};

export function rolesForGroup(group) {
  if (group.roles?.length === group.ages.length) return group.roles;
  return group.ages.map(() => "casual");
}

/** `human` | `dog` | `cat` per crossing figure — parallel to `ages`. */
export function kindsForGroup(group) {
  const ages = group.ages ?? [];
  const n = ages.length;
  if (group.kinds?.length === n) return group.kinds;
  return ages.map(() => "human");
}

export function isPetKind(kind) {
  return kind === "dog" || kind === "cat";
}

export function petHudLabel(kind) {
  if (kind === "dog") return "Dog";
  if (kind === "cat") return "Cat";
  return "";
}

/** `male` | `female` per pedestrian — parallel to `ages`. Optional; defaults to a mixed pattern. */
export function gendersForGroup(group) {
  const ages = group.ages ?? [];
  const n = ages.length;
  if (group.genders?.length === n) return group.genders;
  return ages.map((age, i) => {
    if (n === 1) return age % 2 === 0 ? "female" : "male";
    return i % 2 === 0 ? "male" : "female";
  });
}

/**
 * Skin tones per pedestrian (parallel to `ages`).
 * Allowed values: veryLight | light | medium | tan | dark
 */
export function skinTonesForGroup(group) {
  const ages = group.ages ?? [];
  const n = ages.length;
  const tones = ["veryLight", "light", "medium", "tan", "dark"];
  if (group.skinTones?.length === n) return group.skinTones;
  return ages.map((age, i) => tones[(age + i) % tones.length]);
}

/** Legend / scenario strip caption (matches HUD short labels). */
export function roleLegendCaption(role) {
  return ROLE_SHORT[role] || role;
}
