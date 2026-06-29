"use client";

import CrosswalkVista from "./CrosswalkVista";
import { variantForAge } from "@/lib/ageIcons";
import {
  isPetKind,
  kindsForGroup,
  petHudLabel,
  ROLE_LABELS,
  roleLegendCaption,
  rolesForGroup,
} from "@/lib/roles";

function LegendStrip({ label, sub, side, group }) {
  const { count, ages, legal } = group;
  const roles = rolesForGroup(group);
  const kinds = kindsForGroup(group);
  const ageLabel = (age, i) => {
    const k = kinds[i] ?? "human";
    if (isPetKind(k)) return petHudLabel(k);
    const v = variantForAge(age);
    return v === "child" ? "Child" : v === "elder" ? "Elder" : "Adult";
  };
  const roleLineFor = (i) => {
    const k = kinds[i] ?? "human";
    if (isPetKind(k)) return "Pet";
    return ROLE_LABELS[roles[i]] || roleLegendCaption(roles[i]);
  };
  const zone =
    legal
      ? "border-2 border-emerald-600/50 bg-emerald-950/30 ring-1 ring-emerald-500/25"
      : "border-2 border-dashed border-orange-500/80 bg-orange-950/25 ring-1 ring-orange-500/35";

  return (
    <div className={`flex flex-1 flex-col rounded-lg px-3 py-2 ${zone}`}>
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
          {label}
        </span>
        <div className="flex flex-col items-start gap-0.5 sm:items-end">
          <span
            className={`rounded px-2 py-0.5 text-[9px] font-black uppercase ${
              legal
                ? "bg-emerald-700 text-white"
                : "bg-orange-600 text-white"
            }`}
          >
            {legal ? "✓ Legal crossing" : "⚠ Jaywalking"}
          </span>
          <span
            className={`max-w-[220px] text-right text-[9px] font-medium leading-snug sm:text-left ${
              legal ? "text-emerald-200/85" : "text-orange-200/90"
            }`}
          >
            {legal
              ? "Marked crosswalk — allowed"
              : "Outside walk / against signal"}
          </span>
        </div>
      </div>
      <p className="mt-1 text-[10px] text-zinc-500">{sub}</p>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-[10px] text-zinc-600">{count}×</span>
        {ages.map((age, i) => {
          const primary = ageLabel(age, i);
          const roleLine = roleLineFor(i);
          const k = kinds[i] ?? "human";
          const tip = isPetKind(k) ? `${primary} (${roleLine})` : `${roleLine} · age ${age}`;
          return (
            <span
              key={i}
              className="inline-flex items-center gap-1 text-[11px] leading-none"
              title={tip}
            >
              <span className="font-semibold text-zinc-200">{primary}</span>
              <span className="text-[10px] opacity-70">·</span>
              <span className="text-[10px] opacity-90">{roleLine}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

export default function ScenarioDisplay({ scenario, showCrosswalk = true }) {
  if (!scenario) return null;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-3">
      {showCrosswalk && <CrosswalkVista scenario={scenario} />}

      <p className="mx-auto max-w-xl text-center text-[10px] leading-relaxed text-zinc-500">
        <span className="font-semibold text-zinc-400">Figures:</span> transparent flat-vector PNG sprites. Roles
        match HUD labels.
        <span className="mt-1 block text-zinc-600">
          <span className="text-emerald-400/90">Green</span> = legal crosswalk ·{" "}
          <span className="text-orange-400/90">Orange dashed</span> = jaywalking.
        </span>
      </p>

      <div className="flex flex-col gap-2 sm:flex-row">
        <LegendStrip
          side="left"
          label="Left crosswalk"
          sub="Swerve → impact here"
          group={scenario.left}
        />
        <LegendStrip
          side="right"
          label="Ahead / right"
          sub="Stay → impact here"
          group={scenario.right}
        />
      </div>
    </div>
  );
}
