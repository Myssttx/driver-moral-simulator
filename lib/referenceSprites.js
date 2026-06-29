/**
 * In-game raster sprites (AI-generated, matched to the flat vector “people pack” look).
 * Stock JPG sheets under `public/character-refs/` are style references only — not cropped in-game.
 */

const BASE = "/sprites/generated";

const ROLE_SPRITE = {
  casual: `${BASE}/pedestrian-casual.png`,
  professional: `${BASE}/pedestrian-professional.png`,
  medical: `${BASE}/pedestrian-medical.png`,
  worker: `${BASE}/pedestrian-worker.png`,
  student: `${BASE}/pedestrian-student.png`,
  athlete: `${BASE}/pedestrian-athlete.png`,
};

export function getHumanSpriteSrc({ role, ageVariant }) {
  if (ageVariant === "child") return `${BASE}/pedestrian-child.png`;
  if (ageVariant === "elder") return `${BASE}/pedestrian-elder.png`;
  return ROLE_SPRITE[role] ?? ROLE_SPRITE.casual;
}

export function getPetSpriteSrc(kind) {
  if (kind === "dog") return `${BASE}/pet-dog.png`;
  if (kind === "cat") return `${BASE}/pet-cat.png`;
  return `${BASE}/pet-dog.png`;
}
