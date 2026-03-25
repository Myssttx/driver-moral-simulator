"use client";

/**
 * Chibi / kawaii-style pedestrians — large head, thick outlines, dot eyes, blush,
 * cell-shaded outfits. Role + age + gender integrated; worker uses hard hat (hair hidden).
 */
const ink = "#111827";
const sw = 3.2;
const g = {
  stroke: ink,
  strokeWidth: sw,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

const SKIN_TONES = {
  veryLight: { base: "#FCE7D8", shadow: "#F3CFB9", blush: "#F9A8B0" },
  light: { base: "#F7D7C0", shadow: "#E9BEA3", blush: "#F59EAA" },
  medium: { base: "#E8B997", shadow: "#D49B75", blush: "#EE8E9D" },
  tan: { base: "#CF9469", shadow: "#B8774E", blush: "#D97786" },
  dark: { base: "#8D5A3C", shadow: "#74452C", blush: "#B15A74" },
};
const blush = "#FCA5A5";

function resolveSkinTone(skinTone) {
  return SKIN_TONES[skinTone] ?? SKIN_TONES.medium;
}

/** Dot eyes + tiny smile + blush — reference style */
function FaceChibi({ cx, cy, glasses = false, skinBase, skinShade, blushColor }) {
  return (
    <g {...g}>
      <circle cx={cx} cy={cy} r={20} fill={skinBase} />
      <ellipse cx={cx - 12} cy={cy + 6} rx="4" ry="2.5" fill={blushColor ?? blush} opacity="0.85" stroke="none" />
      <ellipse cx={cx + 12} cy={cy + 6} rx="4" ry="2.5" fill={blushColor ?? blush} opacity="0.85" stroke="none" />
      <circle cx={cx - 6} cy={cy - 2} r="2.8" fill="#111827" stroke="none" />
      <circle cx={cx + 6} cy={cy - 2} r="2.8" fill="#111827" stroke="none" />
      <circle cx={cx - 7} cy={cy - 3} r="0.9" fill="#fff" stroke="none" />
      <circle cx={cx + 5} cy={cy - 3} r="0.9" fill="#fff" stroke="none" />
      <path
        d={`M ${cx - 5} ${cy + 10} Q ${cx} ${cy + 13} ${cx + 5} ${cy + 10}`}
        fill="none"
        stroke="#111827"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <ellipse cx={cx - 14} cy={cy + 2} rx="3" ry="5" fill={skinShade} opacity="0.35" stroke="none" />
      <ellipse cx={cx + 14} cy={cy + 2} rx="3" ry="5" fill={skinShade} opacity="0.35" stroke="none" />
      {glasses && (
        <g fill="none" stroke={ink} strokeWidth="2">
          <circle cx={cx - 6} cy={cy - 2} r="5" />
          <circle cx={cx + 6} cy={cy - 2} r="5" />
          <line x1={cx - 1} y1={cy - 2} x2={cx + 1} y2={cy - 2} />
        </g>
      )}
    </g>
  );
}

function HairChildMale({ cx, cy }) {
  return (
    <path
      {...g}
      d={`M ${cx - 20} ${cy - 2} Q ${cx} ${cy - 24} ${cx + 20} ${cy - 2} Q ${cx + 14} ${cy - 12} ${cx} ${cy - 14} Q ${cx - 14} ${cy - 12} ${cx - 20} ${cy - 2} Z`}
      fill="#5D4037"
    />
  );
}

function HairChildFemale({ cx, cy }) {
  return (
    <g>
      <path
        {...g}
        d={`M ${cx - 18} ${cy - 4} Q ${cx} ${cy - 22} ${cx + 18} ${cy - 4} Q ${cx + 10} ${cy - 14} ${cx} ${cy - 16} Q ${cx - 10} ${cy - 14} ${cx - 18} ${cy - 4} Z`}
        fill="#5D4037"
      />
      <ellipse cx={cx - 22} cy={cy + 8} rx="7" ry="11" fill="#4E342E" stroke={ink} strokeWidth="2.5" />
      <ellipse cx={cx + 22} cy={cy + 8} rx="7" ry="11" fill="#4E342E" stroke={ink} strokeWidth="2.5" />
      <path
        d={`M ${cx - 22} ${cy + 4} Q ${cx - 20} ${cy + 12} ${cx - 18} ${cy + 16}`}
        fill="none"
        stroke="#3E2723"
        strokeWidth="1.5"
        opacity="0.5"
      />
      <path
        d={`M ${cx + 22} ${cy + 4} Q ${cx + 20} ${cy + 12} ${cx + 18} ${cy + 16}`}
        fill="none"
        stroke="#3E2723"
        strokeWidth="1.5"
        opacity="0.5"
      />
    </g>
  );
}

function HairAdultMale({ cx, cy }) {
  return (
    <g>
      <path
        {...g}
        d={`M ${cx - 19} ${cy - 4} Q ${cx} ${cy - 22} ${cx + 19} ${cy - 4} L ${cx + 17} ${cy + 4} Q ${cx} ${cy - 2} ${cx - 17} ${cy + 4} Z`}
        fill="#3E2723"
      />
      <path
        d={`M ${cx - 12} ${cy - 6} Q ${cx} ${cy - 16} ${cx + 12} ${cy - 6}`}
        fill="none"
        stroke="#1f1410"
        strokeWidth="2"
        opacity="0.35"
      />
    </g>
  );
}

function HairAdultFemale({ cx, cy }) {
  return (
    <g>
      <path
        {...g}
        d={`M ${cx - 18} ${cy - 6} Q ${cx} ${cy - 24} ${cx + 18} ${cy - 6} Q ${cx + 8} ${cy - 14} ${cx} ${cy - 16} Q ${cx - 8} ${cy - 14} ${cx - 18} ${cy - 6} Z`}
        fill="#4E342E"
      />
      <path
        {...g}
        d={`M ${cx - 18} ${cy} Q ${cx - 26} ${cy + 28} ${cx - 14} ${cy + 42} Q ${cx - 10} ${cy + 22} ${cx - 8} ${cy + 6} Z`}
        fill="#4E342E"
      />
      <path
        {...g}
        d={`M ${cx + 18} ${cy} Q ${cx + 26} ${cy + 28} ${cx + 14} ${cy + 42} Q ${cx + 10} ${cy + 22} ${cx + 8} ${cy + 6} Z`}
        fill="#3E2723"
      />
    </g>
  );
}

function HairElderMale({ cx, cy }) {
  return (
    <g>
      <path
        {...g}
        d={`M ${cx - 19} ${cy - 2} Q ${cx} ${cy - 18} ${cx + 19} ${cy - 2} Q ${cx + 12} ${cy - 12} ${cx} ${cy - 14} Q ${cx - 12} ${cy - 12} ${cx - 19} ${cy - 2} Z`}
        fill="#E5E5E5"
      />
      <path
        d={`M ${cx - 6} ${cy - 4} L ${cx + 6} ${cy - 2}`}
        stroke="#B8B8B8"
        strokeWidth="1.5"
        fill="none"
        opacity="0.6"
      />
    </g>
  );
}

function HairElderFemale({ cx, cy }) {
  return (
    <g>
      <path
        {...g}
        d={`M ${cx - 18} ${cy - 4} Q ${cx} ${cy - 20} ${cx + 18} ${cy - 4} Q ${cx + 8} ${cy - 12} ${cx} ${cy - 14} Q ${cx - 8} ${cy - 12} ${cx - 18} ${cy - 4} Z`}
        fill="#D4D4D4"
      />
      <circle cx={cx + 8} cy={cy - 14} r="6" fill="#C4C4C4" stroke={ink} strokeWidth="2.5" />
    </g>
  );
}

function HardHat({ cx, cy }) {
  return (
    <g {...g}>
      <path
        d={`M ${cx - 22} ${cy} Q ${cx} ${cy - 18} ${cx + 22} ${cy} L ${cx + 20} ${cy + 6} L ${cx - 20} ${cy + 6} Z`}
        fill="#FACC15"
      />
      <ellipse cx={cx} cy={cy - 6} rx="14" ry="5" fill="#FDE047" opacity="0.6" stroke="none" />
      <line x1={cx - 19} y1={cy + 3} x2={cx + 19} y2={cy + 3} stroke="#CA8A04" strokeWidth="2" />
      <rect x={cx - 4} y={cy + 4} width="8" height="4" rx="1" fill="#A16207" stroke={ink} strokeWidth="1.5" />
    </g>
  );
}

function ChibiLegs({ x, y, shoe = "#F8FAFC" }) {
  return (
    <g {...g}>
      <line x1={x - 8} y1={y} x2={x - 8} y2={y + 14} strokeWidth="4" />
      <line x1={x + 8} y1={y} x2={x + 8} y2={y + 14} strokeWidth="4" />
      <ellipse cx={x - 8} cy={y + 16} rx="7" ry="4" fill={shoe} />
      <ellipse cx={x + 8} cy={y + 16} rx="7" ry="4" fill={shoe} />
      <line x1={x - 12} y1={y + 16} x2={x - 4} y2={y + 16} stroke="#CBD5E1" strokeWidth="1.2" />
      <line x1={x + 4} y1={y + 16} x2={x + 12} y2={y + 16} stroke="#CBD5E1" strokeWidth="1.2" />
    </g>
  );
}

function ChibiArms({ x, y, short = false, skinBase }) {
  const dy = short ? 10 : 12;
  return (
    <g {...g}>
      <path d={`M ${x - 18} ${y} L ${x - 26} ${y + dy}`} strokeWidth="4" />
      <path d={`M ${x + 18} ${y} L ${x + 26} ${y + dy}`} strokeWidth="4" />
      <circle cx={x - 28} cy={y + dy + 1} r="4" fill={skinBase} />
      <circle cx={x + 28} cy={y + dy + 1} r="4" fill={skinBase} />
    </g>
  );
}

function AdultBody({ attire }) {
  const neckY = 54;
  switch (attire) {
    case "professional":
      return (
        <g>
          <path
            {...g}
            d="M50 56 L34 60 L30 88 Q30 98 38 104 L62 104 Q70 98 70 88 L66 60 Z"
            fill="#1E293B"
          />
          <path d="M36 62 L44 100 Q50 98 56 100 L64 62" fill="#0F172A" opacity="0.25" stroke="none" />
          <path d="M50 58 L44 68 L50 72 L56 68 Z" fill="#F8FAFC" />
          <path d="M50 62 L50 88" stroke="#B91C1C" strokeWidth="6" strokeLinecap="round" />
          <rect x="58" y="72" width="12" height="9" rx="1" fill="#E2E8F0" stroke={ink} strokeWidth="2" />
          <text x="64" y="79" fontSize="6" fill="#1e3a5f" fontWeight="bold" stroke="none" textAnchor="middle">
            ID
          </text>
        </g>
      );
    case "medical":
      return (
        <g>
          <path
            {...g}
            d="M50 54 L32 58 L28 86 Q28 96 36 102 L64 102 Q72 96 72 86 L68 58 Z"
            fill="#0D9488"
          />
          <path d="M34 60 L40 96 Q50 94 60 96 L66 60" fill="#0F766E" opacity="0.35" stroke="none" />
          <rect x="32" y="66" width="14" height="14" rx="2" fill="#fff" stroke={ink} strokeWidth="2" />
          <line x1="39" y1="66" x2="39" y2="80" stroke="#DC2626" strokeWidth="3" />
          <line x1="32" y1="73" x2="46" y2="73" stroke="#DC2626" strokeWidth="3" />
          <path d="M50 58 Q38 70 36 88 M50 58 Q62 70 64 88" stroke="#475569" strokeWidth="2.5" fill="none" />
          <circle cx="50" cy="92" r="5" fill="#64748B" stroke={ink} strokeWidth="1.5" />
        </g>
      );
    case "worker":
      return (
        <g>
          <path
            {...g}
            d="M50 56 L34 60 L28 88 Q28 98 38 104 L62 104 Q72 98 72 88 L66 60 Z"
            fill="#44403C"
          />
          <rect x="28" y="64" width="44" height="32" rx="3" fill="#D9F99D" stroke={ink} strokeWidth="2.5" />
          <line x1="30" y1="74" x2="70" y2="74" stroke="#fff" strokeWidth="5" />
          <line x1="30" y1="86" x2="70" y2="86" stroke="#fff" strokeWidth="5" />
          <text x="50" y="84" textAnchor="middle" fontSize="9" fontWeight="900" fill="#365314" stroke="none">
            HI-VIS
          </text>
        </g>
      );
    case "athlete":
      return (
        <g>
          <path
            {...g}
            d="M50 54 L34 58 L28 84 Q28 94 38 100 L62 100 Q72 94 72 84 L66 58 Z"
            fill="#EA580C"
          />
          <path d="M36 60 L40 94 Q50 92 60 94 L64 60" fill="#9A3412" opacity="0.2" stroke="none" />
          <line x1="34" y1="62" x2="66" y2="62" stroke={ink} strokeWidth="2" opacity="0.3" />
          <text
            x="50"
            y="88"
            textAnchor="middle"
            fill="#fff"
            stroke={ink}
            strokeWidth="0.6"
            paintOrder="stroke fill"
            fontSize="20"
            fontWeight="900"
            fontFamily="system-ui,sans-serif"
          >
            7
          </text>
        </g>
      );
    case "student":
      return (
        <g>
          <rect x="20" y="60" width="14" height="34" rx="3" fill="#1E3A8A" stroke={ink} strokeWidth="2.5" />
          <rect x="66" y="60" width="14" height="34" rx="3" fill="#1E3A8A" stroke={ink} strokeWidth="2.5" />
          <path
            {...g}
            d="M50 52 L34 56 L28 84 Q28 96 38 102 L62 102 Q72 96 72 84 L66 56 Z"
            fill="#2563EB"
          />
          <rect x="36" y="64" width="28" height="12" rx="3" fill="#1D4ED8" opacity="0.45" stroke="none" />
          <path d="M50 72 L50 82" stroke={ink} strokeWidth="1.5" opacity="0.4" />
        </g>
      );
    default:
      return (
        <g>
          <path
            {...g}
            d="M50 54 L34 58 L30 78 L34 78 L36 102 L64 102 L66 78 L70 78 L66 58 Z"
            fill="#38BDF8"
          />
          <path d="M34 78 L36 102 L64 102 L66 78 Z" fill="#0369A1" opacity="0.45" stroke="none" />
          <circle cx="50" cy="68" r="2" fill="#0C4A6E" stroke="none" />
        </g>
      );
  }
}

function ChildBody({ attire }) {
  switch (attire) {
    case "professional":
      return (
        <path
          {...g}
          d="M40 52 L28 56 L26 76 Q26 88 32 94 L48 94 Q54 88 54 76 L52 56 Z"
          fill="#1E3A5F"
        />
      );
    case "student":
      return (
        <g>
          <rect x="16" y="58" width="12" height="28" rx="2" fill="#1E3A8A" stroke={ink} strokeWidth="2" />
          <rect x="52" y="58" width="12" height="28" rx="2" fill="#1E3A8A" stroke={ink} strokeWidth="2" />
          <path
            {...g}
            d="M40 50 L28 54 L26 74 Q26 86 32 92 L48 92 Q54 86 54 74 L52 54 Z"
            fill="#3B82F6"
          />
        </g>
      );
    case "athlete":
      return (
        <g>
          <path {...g} d="M40 48 L26 52 L24 72 Q24 84 30 90 L50 90 Q56 84 56 72 L54 52 Z" fill="#EA580C" />
          <text
            x="40"
            y="78"
            textAnchor="middle"
            fill="#fff"
            stroke={ink}
            strokeWidth="0.6"
            fontSize="14"
            fontWeight="900"
            fontFamily="system-ui,sans-serif"
          >
            3
          </text>
        </g>
      );
    case "medical":
      return (
        <g>
          <path {...g} d="M40 50 L28 54 L26 74 Q26 86 32 92 L48 92 Q54 86 54 74 L52 54 Z" fill="#14B8A6" />
          <rect x="30" y="62" width="12" height="12" rx="1" fill="#fff" stroke={ink} strokeWidth="1.5" />
          <line x1="36" y1="62" x2="36" y2="74" stroke="#DC2626" strokeWidth="2" />
          <line x1="30" y1="68" x2="42" y2="68" stroke="#DC2626" strokeWidth="2" />
        </g>
      );
    case "worker":
      return (
        <g>
          <path {...g} d="M40 52 L28 56 L26 76 Q26 88 32 94 L48 94 Q54 88 54 76 L52 56 Z" fill="#57534E" />
          <rect x="24" y="60" width="32" height="22" rx="2" fill="#D9F99D" stroke={ink} strokeWidth="2" />
          <line x1="26" y1="68" x2="54" y2="68" stroke="#fff" strokeWidth="3" />
          <line x1="26" y1="76" x2="54" y2="76" stroke="#fff" strokeWidth="3" />
        </g>
      );
    default:
      return <path {...g} d="M40 50 L28 54 L26 74 Q26 86 32 92 L48 92 Q54 86 54 74 L52 54 Z" fill="#F472B6" />;
  }
}

function ElderBody({ attire }) {
  switch (attire) {
    case "professional":
      return (
        <g>
          <path
            {...g}
            d="M50 58 L32 62 L28 90 Q28 102 38 108 L62 108 Q72 102 72 90 L68 62 Z"
            fill="#1E3A5F"
          />
          <path d="M50 62 L44 72 L50 76 L56 72 Z" fill="#F1F5F9" stroke={ink} strokeWidth="2" />
          <path d="M50 68 L50 90" stroke="#9F1239" strokeWidth="5" strokeLinecap="round" />
        </g>
      );
    case "medical":
      return (
        <g>
          <path
            {...g}
            d="M50 58 L32 62 L28 90 Q28 102 38 108 L62 108 Q72 102 72 90 L68 62 Z"
            fill="#0D9488"
          />
          <rect x="34" y="72" width="14" height="14" rx="2" fill="#fff" stroke={ink} strokeWidth="2" />
          <line x1="41" y1="72" x2="41" y2="86" stroke="#DC2626" strokeWidth="2.5" />
          <line x1="34" y1="79" x2="48" y2="79" stroke="#DC2626" strokeWidth="2.5" />
          <circle cx="50" cy="96" r="5" fill="#64748B" stroke={ink} strokeWidth="1.5" />
        </g>
      );
    case "worker":
      return (
        <g>
          <path
            {...g}
            d="M50 58 L32 62 L28 90 Q28 102 38 108 L62 108 Q72 102 72 90 L68 62 Z"
            fill="#44403C"
          />
          <rect x="28" y="66" width="44" height="32" rx="3" fill="#D9F99D" stroke={ink} strokeWidth="2.5" />
          <line x1="30" y1="76" x2="70" y2="76" stroke="#fff" strokeWidth="4" />
          <line x1="30" y1="88" x2="70" y2="88" stroke="#fff" strokeWidth="4" />
        </g>
      );
    case "athlete":
      return (
        <path
          {...g}
          d="M50 56 L34 60 L28 86 Q28 98 38 104 L62 104 Q72 98 72 86 L66 60 Z"
          fill="#C2410C"
        />
      );
    default:
      return (
        <g>
          <path
            {...g}
            d="M50 58 L32 62 L28 90 Q28 102 38 108 L62 108 Q72 102 72 90 L68 62 Z"
            fill="#C4B5FD"
          />
          <path d="M38 78 Q50 84 62 78" fill="none" stroke="#7C3AED" strokeWidth="1.5" opacity="0.5" />
        </g>
      );
  }
}

export default function CartoonPerson({
  variant = "adult",
  attire = "casual",
  gender = "male",
  skinTone = "medium",
  className = "",
}) {
  const a =
    attire === "professional" ||
    attire === "athlete" ||
    attire === "medical" ||
    attire === "worker" ||
    attire === "student"
      ? attire
      : "casual";

  const isF = gender === "female";
  const helmet = a === "worker";
  const skinToneSet = resolveSkinTone(skinTone);
  const skinBase = skinToneSet.base;
  const skinShade = skinToneSet.shadow;
  const blushColor = skinToneSet.blush;

  if (variant === "child") {
    const x = 40;
    const faceY = 34;
    return (
      <svg className={className} viewBox="0 0 80 118" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
        <ChibiLegs x={x} y={88} />
        <ChildBody attire={a} />
        <ChibiArms x={x} y={58} short skinBase={skinBase} />
        <path d={`M ${x} ${faceY + 18} L ${x} ${56}`} stroke={skinBase} strokeWidth="6" strokeLinecap="round" />
        {!helmet && (isF ? <HairChildFemale cx={x} cy={faceY} /> : <HairChildMale cx={x} cy={faceY} />)}
        {helmet && <HardHat cx={x} cy={faceY - 2} />}
        <FaceChibi cx={x} cy={faceY} skinBase={skinBase} skinShade={skinShade} blushColor={blushColor} />
      </svg>
    );
  }

  if (variant === "elder") {
    const x = 50;
    const faceY = 36;
    return (
      <svg className={className} viewBox="0 0 100 128" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
        <ChibiLegs x={x} y={92} shoe="#E2E8F0" />
        <ElderBody attire={a} />
        <ChibiArms x={x} y={62} skinBase={skinBase} />
        <path d={`M ${x} ${faceY + 18} L ${x} ${58}`} stroke={skinBase} strokeWidth="6" strokeLinecap="round" />
        {isF ? <HairElderFemale cx={x} cy={faceY} /> : <HairElderMale cx={x} cy={faceY} />}
        <FaceChibi cx={x} cy={faceY} glasses skinBase={skinBase} skinShade={skinShade} blushColor={blushColor} />
        {/* Elder cues: extra brow lines + thicker cane */}
        <g {...g}>
          <path d={`M ${x - 14} ${faceY - 6} Q ${x} ${faceY - 11} ${x + 14} ${faceY - 6}`} fill="none" strokeWidth="2.5" opacity="0.7" />
          <path d={`M ${x - 10} ${faceY + 1} Q ${x} ${faceY - 2} ${x + 10} ${faceY + 1}`} fill="none" strokeWidth="2.2" opacity="0.55" />
        </g>

        <g {...g}>
          <ellipse cx="78" cy="108" rx="10" ry="3.5" fill="#0B1220" opacity="0.18" stroke="none" />
          <line x1="78" y1="70" x2="78" y2="112" strokeWidth="5" opacity="0.95" />
          <circle cx="78" cy="63" r="6" fill="#CBD5E1" stroke={ink} strokeWidth="2.5" />
          <path d="M82 112 L88 115" strokeWidth="5" strokeLinecap="round" />
        </g>
      </svg>
    );
  }

  const x = 50;
  const faceY = 34;
  return (
    <svg className={className} viewBox="0 0 100 128" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <ChibiLegs x={x} y={90} />
      <AdultBody attire={a} />
      <ChibiArms x={x} y={60} skinBase={skinBase} />
      <path d={`M ${x} ${faceY + 18} L ${x} ${56}`} stroke={skinBase} strokeWidth="6" strokeLinecap="round" />
      {!helmet && (isF ? <HairAdultFemale cx={x} cy={faceY} /> : <HairAdultMale cx={x} cy={faceY} />)}
      {helmet && <HardHat cx={x} cy={faceY - 2} />}
      <FaceChibi cx={x} cy={faceY} skinBase={skinBase} skinShade={skinShade} blushColor={blushColor} />
    </svg>
  );
}
