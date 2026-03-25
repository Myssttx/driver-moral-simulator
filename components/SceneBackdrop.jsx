"use client";

import { useId } from "react";
import { VS } from "@/lib/vectorSceneTheme";

/**
 * Full-width vector horizon: layered sky, clouds, hills, skyline, trees — not a flat color slab.
 */
export default function SceneBackdrop({ className = "" }) {
  const uid = useId().replace(/:/g, "");

  return (
    <svg
      className={`pointer-events-none absolute inset-x-0 top-0 w-full ${className}`}
      style={{ height: "56%" }}
      viewBox="0 0 800 340"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
    >
      <defs>
        <linearGradient id={`vsSky-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={VS.skyTop} />
          <stop offset="38%" stopColor={VS.skyMid} />
          <stop offset="72%" stopColor={VS.skyBottom} />
          <stop offset="100%" stopColor="#B8D4E8" />
        </linearGradient>
        <linearGradient id={`vsHill-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6EAD7A" />
          <stop offset="100%" stopColor={VS.treeDark} />
        </linearGradient>
        <linearGradient id={`vsHill2-${uid}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#5CB87A" />
          <stop offset="100%" stopColor="#4A9E68" />
        </linearGradient>
      </defs>

      <rect width="800" height="340" fill={`url(#vsSky-${uid})`} />

      {/* Soft horizon haze */}
      <rect x="0" y="175" width="800" height="90" fill={VS.skyBottom} opacity="0.35" />

      <circle cx="120" cy="58" r="3" fill={VS.strokeSoft} opacity="0.35" />
      <circle cx="145" cy="42" r="2" fill={VS.strokeSoft} opacity="0.3" />
      <circle cx="610" cy="48" r="2.5" fill={VS.strokeSoft} opacity="0.35" />

      <circle cx="698" cy="44" r="24" fill="#FFE566" stroke={VS.strokeSoft} strokeWidth="1.5" opacity="0.95" />

      <g opacity="0.92">
        <ellipse cx="95" cy="62" rx="52" ry="19" fill={VS.cloudLight} stroke={VS.strokeSoft} strokeWidth="1" />
        <ellipse cx="128" cy="56" rx="38" ry="15" fill={VS.cloudMid} stroke={VS.strokeSoft} strokeWidth="0.8" />
        <ellipse cx="310" cy="48" rx="46" ry="17" fill={VS.cloudLight} stroke={VS.strokeSoft} strokeWidth="1" />
        <ellipse cx="342" cy="42" rx="34" ry="13" fill={VS.cloudMid} stroke={VS.strokeSoft} strokeWidth="0.8" />
        <ellipse cx="498" cy="68" rx="58" ry="21" fill={VS.cloudLight} stroke={VS.strokeSoft} strokeWidth="1" />
        <ellipse cx="538" cy="60" rx="42" ry="17" fill={VS.cloudMid} stroke={VS.strokeSoft} strokeWidth="0.8" />
        <ellipse cx="220" cy="28" rx="28" ry="10" fill="#fff" stroke={VS.strokeSoft} strokeWidth="0.6" opacity="0.85" />
      </g>

      {/* Distant rolling hills */}
      <g stroke={VS.stroke} strokeWidth="1" opacity="0.9">
        <path
          d="M0 210 Q120 175 260 195 T520 188 T800 200 V340 H0 Z"
          fill={`url(#vsHill-${uid})`}
          strokeLinejoin="round"
        />
        <path
          d="M0 228 Q200 205 400 218 T800 222 V340 H0 Z"
          fill={`url(#vsHill2-${uid})`}
          opacity="0.88"
          strokeLinejoin="round"
        />
      </g>

      {/* City blocks — varied heights */}
      <g stroke={VS.stroke} strokeWidth="1.1">
        <rect x="32" y="168" width="36" height="88" fill={VS.building} rx="1" />
        <rect x="72" y="152" width="40" height="104" fill={VS.buildingRoof} rx="1" />
        <rect x="116" y="178" width="48" height="78" fill={VS.building} rx="1" />
        <rect x="168" y="162" width="28" height="94" fill={VS.buildingRoof} rx="1" />
        <rect x="588" y="158" width="34" height="98" fill={VS.buildingRoof} rx="1" />
        <rect x="626" y="172" width="44" height="84" fill={VS.building} rx="1" />
        <rect x="674" y="165" width="30" height="91" fill={VS.buildingRoof} rx="1" />
        <rect x="708" y="182" width="52" height="74" fill={VS.building} rx="1" />
      </g>

      {/* Mid fence / guardrail hint */}
      <g stroke={VS.strokeSoft} strokeWidth="1.2" opacity="0.65">
        <line x1="0" y1="248" x2="800" y2="248" strokeDasharray="6 5" />
        <line x1="0" y1="252" x2="800" y2="252" strokeDasharray="6 5" />
      </g>

      {/* Tree line */}
      <g stroke={VS.stroke} strokeWidth="1.2">
        <line x1="220" y1="298" x2="220" y2="258" strokeLinecap="round" stroke={VS.treeDark} strokeWidth="4" />
        <circle cx="220" cy="240" r="24" fill={VS.treeLight} />
        <line x1="268" y1="302" x2="268" y2="265" strokeLinecap="round" stroke={VS.treeDark} strokeWidth="4" />
        <circle cx="268" cy="246" r="20" fill={VS.treeDark} />
        <circle cx="268" cy="238" r="14" fill={VS.treeLight} />
        <line x1="312" y1="300" x2="312" y2="272" strokeLinecap="round" stroke={VS.treeDark} strokeWidth="3.5" />
        <circle cx="312" cy="256" r="19" fill={VS.treeLight} />
        <line x1="488" y1="299" x2="488" y2="262" strokeLinecap="round" stroke={VS.treeDark} strokeWidth="4" />
        <circle cx="488" cy="242" r="22" fill={VS.treeDark} />
        <circle cx="488" cy="234" r="15" fill={VS.treeLight} />
        <line x1="536" y1="302" x2="536" y2="268" strokeLinecap="round" stroke={VS.treeDark} strokeWidth="3.5" />
        <circle cx="536" cy="250" r="20" fill={VS.treeLight} />
      </g>

      {/* Foreground verge + road seam (ties into HTML road) */}
      <path
        d="M0 312 Q400 288 800 312 L800 340 L0 340 Z"
        fill={VS.roadFar}
        stroke={VS.stroke}
        strokeWidth="1"
        opacity="0.92"
      />
      <path
        d="M0 318 Q400 302 800 318"
        fill="none"
        stroke={VS.treeLight}
        strokeWidth="2"
        opacity="0.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
