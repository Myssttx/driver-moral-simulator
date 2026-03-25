"use client";

/** Chibi pets — same bold outline language as CartoonPerson. */
const ink = "#111827";
const sw = 3.2;
const g = {
  stroke: ink,
  strokeWidth: sw,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

export default function CartoonPet({ species = "dog", className = "" }) {
  if (species === "cat") {
    return (
      <svg
        className={className}
        viewBox="0 0 88 108"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        <ellipse cx="44" cy="96" rx="18" ry="5" fill="#0B1220" opacity="0.14" stroke="none" />
        {/* Tail */}
        <path
          d="M68 78 Q82 52 76 38 Q72 30 64 34"
          fill="#F59E0B"
          stroke={ink}
          strokeWidth={sw}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Body */}
        <ellipse cx="44" cy="78" rx="22" ry="14" fill="#FBBF24" {...g} />
        {/* Back legs */}
        <path {...g} d="M32 88 L28 102 M56 88 L60 102" fill="none" />
        <ellipse cx="28" cy="103" rx="5" ry="3" fill="#CA8A04" {...g} />
        <ellipse cx="60" cy="103" rx="5" ry="3" fill="#CA8A04" {...g} />
        {/* Head */}
        <circle cx="44" cy="48" r="22" fill="#FCD34D" {...g} />
        {/* Ears */}
        <path
          {...g}
          d="M28 38 L24 18 L38 32 Z"
          fill="#F59E0B"
        />
        <path
          {...g}
          d="M60 38 L64 18 L50 32 Z"
          fill="#F59E0B"
        />
        {/* Face */}
        <circle cx="36" cy="46" r="3.2" fill={ink} stroke="none" />
        <circle cx="52" cy="46" r="3.2" fill={ink} stroke="none" />
        <circle cx="35" cy="45" r="1" fill="#fff" stroke="none" />
        <circle cx="51" cy="45" r="1" fill="#fff" stroke="none" />
        <path
          d="M40 54 Q44 58 48 54"
          fill="none"
          stroke={ink}
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <path d="M26 50 L18 48 M26 54 L16 54 M26 58 L18 60" stroke={ink} strokeWidth="2" strokeLinecap="round" />
        <path d="M62 50 L70 48 M62 54 L72 54 M62 58 L70 60" stroke={ink} strokeWidth="2" strokeLinecap="round" />
        {/* Front paws */}
        <ellipse cx="38" cy="88" rx="6" ry="5" fill="#FCD34D" {...g} />
        <ellipse cx="50" cy="88" rx="6" ry="5" fill="#FCD34D" {...g} />
      </svg>
    );
  }

  /* Dog */
  return (
    <svg
      className={className}
      viewBox="0 0 88 108"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <ellipse cx="44" cy="96" rx="18" ry="5" fill="#0B1220" opacity="0.14" stroke="none" />
      <path
        d="M20 72 Q12 58 14 44 Q16 36 22 40"
        fill="#92400E"
        stroke={ink}
        strokeWidth={sw}
        strokeLinejoin="round"
      />
      <ellipse cx="44" cy="78" rx="24" ry="15" fill="#A16207" {...g} />
      <path {...g} d="M30 90 L26 102 M58 90 L62 102" fill="none" />
      <ellipse cx="26" cy="103" rx="5" ry="3" fill="#713F12" {...g} />
      <ellipse cx="62" cy="103" rx="5" ry="3" fill="#713F12" {...g} />
      <ellipse cx="44" cy="50" rx="24" ry="20" fill="#CA8A04" {...g} />
      <path
        {...g}
        d="M22 44 Q18 28 26 22 Q30 18 34 26 Q32 38 28 48"
        fill="#A16207"
      />
      <path
        {...g}
        d="M66 44 Q70 28 62 22 Q58 18 54 26 Q56 38 60 48"
        fill="#A16207"
      />
      <ellipse cx="36" cy="48" rx="3.4" ry="3.8" fill={ink} stroke="none" />
      <ellipse cx="52" cy="48" rx="3.4" ry="3.8" fill={ink} stroke="none" />
      <ellipse cx="35" cy="47" rx="1.1" ry="1.2" fill="#fff" stroke="none" />
      <ellipse cx="51" cy="47" rx="1.1" ry="1.2" fill="#fff" stroke="none" />
      <ellipse cx="44" cy="58" rx="5" ry="4" fill="#713F12" opacity="0.35" stroke="none" />
      <path
        d="M40 60 Q44 64 48 60"
        fill="none"
        stroke={ink}
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <ellipse cx="38" cy="88" rx="6" ry="5" fill="#CA8A04" {...g} />
      <ellipse cx="50" cy="88" rx="6" ry="5" fill="#CA8A04" {...g} />
    </svg>
  );
}
