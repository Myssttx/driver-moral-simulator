"use client";

import { createPortal } from "react-dom";
import RasterSprite from "./RasterSprite";
import SceneBackdrop from "./SceneBackdrop";
import { useCockpitLabelLayer } from "@/components/CockpitLabelLayerContext";
import { VS } from "@/lib/vectorSceneTheme";
import { variantForAge } from "@/lib/ageIcons";
import {
  isPetKind,
  kindsForGroup,
  petHudLabel,
  ROLE_SHORT,
  rolesForGroup,
} from "@/lib/roles";
import { getHumanSpriteSrc, getPetSpriteSrc } from "@/lib/referenceSprites";

/** One side’s people in a single horizontal row — no stacking / wrap. */
function CrosswalkHalf({
  group,
  side,
  embedded,
  legalLabelSide,
  /** When false, no HUD pill (e.g. labels rendered in cockpit portal above overlay). */
  showHudLabels,
  /** `placeholder` reserves the same footprint without drawing figures (portal mirror). */
  figureMode = "full",
  /** Hide legal copy but keep layout height (portal mirror). */
  hideLegalBanner = false,
}) {
  const { ages, legal } = group;
  const roles = rolesForGroup(group);
  const kinds = kindsForGroup(group);
  const zoneClass = legal
    ? "border-2 border-solid border-emerald-600/60 bg-emerald-500/10 ring-1 ring-emerald-500/25"
    : "border-2 border-dashed border-orange-500 bg-orange-400/12 ring-2 ring-orange-400/40 [background-image:repeating-linear-gradient(135deg,transparent,transparent_6px,rgba(251,146,60,0.12)_6px,rgba(251,146,60,0.12)_12px)]";

  const personBox =
    "relative flex min-w-0 flex-1 flex-col items-center justify-end";

  const hudOn =
    showHudLabels !== undefined ? showHudLabels : embedded;
  const placeholderH = embedded
    ? "min-h-[3.75rem] sm:min-h-[4.5rem]"
    : "min-h-[4.5rem] sm:min-h-[5.25rem]";

  return (
    <div
      className={`flex min-h-0 min-w-0 flex-1 flex-col rounded-lg px-0.5 pt-2 sm:px-1 sm:pt-3 ${zoneClass}`}
    >
      <div
        className={`mb-1 flex flex-col gap-0.5 ${legalLabelSide === "start" ? "items-start pl-1" : "items-end pr-1"} ${
          hideLegalBanner ? "invisible" : ""
        }`}
      >
        <span
          className={`rounded-md px-2 py-0.5 text-[8px] font-black uppercase tracking-wide sm:text-[9px] ${
            legal
              ? "bg-emerald-800 text-white ring-1 ring-emerald-400/60"
              : "bg-orange-600 text-white ring-1 ring-orange-300"
          }`}
        >
          {legal ? "✓ Legal crossing" : "⚠ Jaywalking"}
        </span>
        <span
          className={`max-w-[95%] text-[7px] font-semibold leading-tight sm:text-[8px] ${
            legal ? "text-emerald-900/85" : "text-orange-900/90"
          }`}
        >
          {legal
            ? "In the marked crosswalk — they have the walk"
            : "Crossing outside the walk / against the light — not allowed"}
        </span>
      </div>
      <div className="flex w-full min-w-0 flex-nowrap items-end justify-evenly gap-x-0.5 sm:gap-x-1">
        {ages.map((age, i) => {
          const kind = kinds[i] ?? "human";
          const pet = isPetKind(kind);
          const ageVar = variantForAge(age);
          const ageLabel = ageVar === "child" ? "Child" : ageVar === "elder" ? "Elder" : "Adult";
          const roleShort = ROLE_SHORT[roles[i]] ?? roles[i];
          const roleHud = pet
            ? petHudLabel(kind)
            : roleShort
              ? `${ageLabel} · ${roleShort}`
              : ageLabel;
          const tipPet = pet ? petHudLabel(kind) : `Age ${age}${roleShort ? ` · ${roleShort}` : ""}`;
          const elderPill = !pet && ageVar === "elder";
          /** Tall PNGs were only width-capped and overflowed the windshield; bound both axes. */
          const figureSlot =
            pet
              ? embedded
                ? "mx-auto flex h-[3.75rem] w-full max-w-[58px] items-end justify-center sm:h-[4.5rem] sm:max-w-[68px]"
                : "mx-auto flex h-[4.5rem] w-full max-w-[64px] items-end justify-center sm:h-[5.25rem] sm:max-w-[76px]"
              : embedded
                ? "mx-auto flex h-[3.75rem] w-full max-w-[44px] items-end justify-center sm:h-[4.5rem] sm:max-w-[52px]"
                : "mx-auto flex h-[4.5rem] w-full max-w-[50px] items-end justify-center sm:h-[5.25rem] sm:max-w-[58px]";
          return (
            <div
              key={`${side}-${i}`}
              className={personBox}
              title={`${tipPet} · ${legal ? "legal" : "jaywalking"}`}
            >
              <div className={figureSlot}>
                {figureMode === "placeholder" ? (
                  <div
                    className={`mx-auto w-full ${placeholderH} shrink-0`}
                    aria-hidden
                  />
                ) : pet ? (
                  <RasterSprite
                    src={getPetSpriteSrc(kind)}
                    title={tipPet}
                    className="drop-shadow-[0_4px_6px_rgba(0,0,0,0.55)]"
                  />
                ) : (
                  <RasterSprite
                    src={getHumanSpriteSrc({ role: roles[i], ageVariant: ageVar })}
                    title={tipPet}
                    className="drop-shadow-[0_4px_6px_rgba(0,0,0,0.55)]"
                  />
                )}
              </div>
              {hudOn && (
                <p
                  className={`pointer-events-none absolute left-1/2 bottom-[-8px] z-20 w-[max-content] max-w-[132px] -translate-x-1/2 rounded px-1 py-0.5 text-center text-[7px] font-semibold leading-snug tracking-tight sm:max-w-[152px] sm:text-[8px] ${
                    elderPill
                      ? "bg-fuchsia-950/70 text-fuchsia-100 ring-1 ring-fuchsia-400/30"
                      : "bg-zinc-950/65 text-zinc-100"
                  }`}
                >
                  {roleHud}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Mirrors embedded layout so HUD pills align with figures; mounts above cockpit SVG. */
function WindshieldHudMirror({ scenario, mountNode }) {
  return createPortal(
    <div className="relative flex h-full min-h-0 w-full flex-col overflow-hidden">
      <div className="relative z-[2] mx-auto flex min-h-0 w-full max-w-full flex-1 flex-col px-1 pb-0 pt-3 sm:px-2 sm:pt-5 min-h-[128px]">
        <div className="shrink-0" style={{ perspective: "520px" }}>
          <div
            className="relative origin-bottom"
            style={{
              transform: "rotateX(52deg)",
              transformStyle: "preserve-3d",
            }}
          >
            <div
              className="relative h-[5.25rem] overflow-hidden rounded-t-lg border-x border-t shadow-[0_-12px_40px_rgba(0,0,0,0.28)] sm:h-24"
              style={{
                borderColor: `${VS.strokeSoft}99`,
                visibility: "hidden",
              }}
              aria-hidden
            />
          </div>
        </div>

        <div className="relative z-[12] mx-0.5 grid min-h-0 w-full min-w-0 flex-1 grid-rows-[1fr_auto] min-h-[100px] sm:mx-1">
          <div className="relative z-10 flex min-h-0 w-full items-end gap-1 px-0.5 pb-1 sm:gap-2 sm:px-1">
            <div className="relative min-w-0 flex-1 rounded-lg">
              <CrosswalkHalf
                embedded
                group={scenario.left}
                side="left"
                legalLabelSide="start"
                showHudLabels
                figureMode="placeholder"
                hideLegalBanner
              />
            </div>
            <div
              className="invisible flex w-5 shrink-0 flex-col items-center justify-end self-stretch sm:w-6"
              aria-hidden
            >
              <div
                className="w-0.5 rounded-full"
                style={{
                  height: "2.25rem",
                  backgroundColor: VS.strokeSoft,
                }}
              />
            </div>
            <div className="relative min-w-0 flex-1 rounded-lg">
              <CrosswalkHalf
                embedded
                group={scenario.right}
                side="right"
                legalLabelSide="end"
                showHudLabels
                figureMode="placeholder"
                hideLegalBanner
              />
            </div>
          </div>
          <div className="relative z-[5] h-11 w-full shrink-0 sm:h-12" aria-hidden />
        </div>

        <p
          className="invisible relative z-10 mx-0.5 pb-0.5 pt-1 text-center text-[7px] font-semibold uppercase tracking-widest sm:mx-1 sm:text-[8px]"
          aria-hidden
        >
          Right lane · centerline on your left
        </p>
      </div>
    </div>,
    mountNode
  );
}

export default function CrosswalkVista({
  scenario,
  embedded = false,
  onChooseLeft,
  onChooseRight,
  choicesDisabled = false,
}) {
  if (!scenario) return null;

  const cockpitLabelLayer = useCockpitLabelLayer();
  const portaledHud = embedded && Boolean(cockpitLabelLayer);

  const rootClass = embedded
    ? "relative flex h-full min-h-0 w-full flex-col overflow-hidden rounded-none border-0 bg-transparent shadow-none"
    : "relative w-full overflow-hidden rounded-xl border shadow-inner";
  const rootStyle = embedded
    ? undefined
    : {
        borderColor: `${VS.strokeSoft}aa`,
        background: `linear-gradient(180deg, ${VS.skyTop} 0%, ${VS.skyBottom} 38%, #e8eef4 55%, #dfe6ec 100%)`,
      };

  const laneSplit = 28;
  const roadSurface = [
    // Strong left/right tint split for immediate lane distinction.
    `linear-gradient(to right, rgba(8,15,28,0.38) 0%, rgba(8,15,28,0.38) calc(${laneSplit}% - 1px), rgba(120,136,158,0.18) calc(${laneSplit}% + 1px), rgba(120,136,158,0.18) 100%)`,
    `linear-gradient(to bottom, ${VS.roadNear} 0%, ${VS.asphalt} 100%)`,
    `repeating-linear-gradient(90deg, transparent, transparent 5px, rgba(0,0,0,0.045) 5px, rgba(0,0,0,0.045) 6px)`,
    `repeating-linear-gradient(0deg, transparent, transparent 12px, rgba(255,255,255,0.04) 12px, rgba(255,255,255,0.04) 13px)`,
  ].join(", ");
  const zoneBtnClass =
    "relative min-w-0 flex-1 rounded-lg text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/80 focus-visible:ring-offset-1 focus-visible:ring-offset-transparent disabled:cursor-not-allowed disabled:opacity-60";

  return (
    <div className={rootClass} style={rootStyle}>
      {embedded && (
        <div
          className="pointer-events-none absolute inset-0 z-0"
          style={{
            background: `linear-gradient(180deg, ${VS.skyBottom}22 0%, ${VS.roadFar}18 42%, ${VS.roadNear}12 72%, transparent 100%)`,
          }}
          aria-hidden
        />
      )}
      <SceneBackdrop className="z-[1]" />

      {/* Road + crosswalk: grid row 2 is the literal strip people stand on */}
      <div
        className={`relative z-[2] mx-auto flex min-h-0 w-full max-w-full flex-1 flex-col px-1 pb-0 pt-3 sm:px-2 sm:pt-5 ${
          embedded ? "min-h-[128px]" : "min-h-[200px] sm:min-h-[252px]"
        }`}
      >
        <div className="shrink-0" style={{ perspective: "520px" }}>
          <div
            className="relative origin-bottom"
            style={{
              transform: "rotateX(52deg)",
              transformStyle: "preserve-3d",
            }}
          >
            <div
              className={`relative overflow-hidden rounded-t-lg border-x border-t shadow-[0_-12px_40px_rgba(0,0,0,0.28)] ${
                embedded ? "h-[5.25rem] sm:h-24" : "h-32 sm:h-40"
              }`}
              style={{
                borderColor: `${VS.strokeSoft}99`,
                backgroundImage: roadSurface,
              }}
            >
              <div className="pointer-events-none absolute inset-0">
                <div
                  className="absolute inset-y-0 left-0"
                  style={{
                    width: `calc(${laneSplit}% - 3px)`,
                    background:
                      "linear-gradient(to bottom, rgba(2,8,23,0.18), rgba(2,8,23,0.34))",
                  }}
                />
                <div
                  className="absolute inset-y-0 right-0"
                  style={{
                    width: `calc(${100 - laneSplit}% - 3px)`,
                    background:
                      "linear-gradient(to bottom, rgba(148,163,184,0.14), rgba(148,163,184,0.26))",
                  }}
                />
              </div>

              <div className="pointer-events-none absolute inset-0 opacity-50 mix-blend-overlay">
                <div
                  className="absolute top-0 bottom-0 w-[6px]"
                  style={{
                    left: `${laneSplit}%`,
                    backgroundColor: VS.laneYellow,
                    boxShadow: `0 0 0 1px rgba(0,0,0,0.45), 0 0 14px ${VS.laneYellowDark}88, 0 0 0 2px ${VS.laneYellowDark}55`,
                  }}
                />
                <div
                  className="absolute top-0 bottom-0 w-[2px]"
                  style={{
                    left: `calc(${laneSplit}% - 8px)`,
                    backgroundColor: `${VS.laneYellow}99`,
                  }}
                />
                <div
                  className="absolute top-0 bottom-0 w-[2px]"
                  style={{
                    left: `calc(${laneSplit}% + 8px)`,
                    backgroundColor: `${VS.laneYellow}99`,
                  }}
                />
              </div>
              <div
                className="pointer-events-none absolute inset-y-0"
                style={{
                  left: `calc(${laneSplit}% + 14px)`,
                  right: "8%",
                  borderLeft: "1px dashed rgba(226,232,240,0.35)",
                }}
              />
              <div
                className="pointer-events-none absolute top-0 bottom-0 w-px opacity-60"
                style={{ right: "6%", backgroundColor: VS.curb }}
                aria-hidden
              />

              <div
                className="absolute inset-x-0 bottom-0 top-[15%]"
                style={{
                  background: `repeating-linear-gradient(90deg, ${VS.crosswalkWhite} 0px, ${VS.crosswalkWhite} 15px, transparent 15px, transparent 28px)`,
                  opacity: 0.94,
                  maskImage:
                    "linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.35) 12%, black 35%, black 100%)",
                  WebkitMaskImage:
                    "linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.35) 12%, black 35%, black 100%)",
                }}
              />
              <div
                className="pointer-events-none absolute inset-x-0 bottom-0 top-[15%] bg-gradient-to-t from-slate-900/18 via-transparent to-transparent"
                aria-hidden
              />
            </div>
          </div>
        </div>

        <div
          className={`relative z-[12] mx-0.5 grid min-h-0 w-full min-w-0 flex-1 grid-rows-[1fr_auto] sm:mx-1 ${
            embedded ? "min-h-[104px]" : "min-h-[148px]"
          }`}
        >
          <div
            className={`relative z-10 flex min-h-0 w-full items-end gap-1 px-0.5 sm:gap-2 sm:px-1 ${
              embedded ? "pb-1" : "pb-0"
            }`}
          >
            {typeof onChooseLeft === "function" ? (
              <button
                type="button"
                onClick={onChooseLeft}
                disabled={choicesDisabled}
                className={`${zoneBtnClass} hover:-translate-y-0.5 hover:brightness-105 active:translate-y-0`}
                aria-label="Choose left side"
                title="Choose left side"
              >
                <CrosswalkHalf
                  embedded={embedded}
                  group={scenario.left}
                  side="left"
                  legalLabelSide="start"
                  showHudLabels={embedded ? !portaledHud : undefined}
                />
              </button>
            ) : (
              <CrosswalkHalf
                embedded={embedded}
                group={scenario.left}
                side="left"
                legalLabelSide="start"
                showHudLabels={embedded ? !portaledHud : undefined}
              />
            )}
            <div
              className="flex w-5 shrink-0 flex-col items-center justify-end self-stretch opacity-70 sm:w-6"
              title="Between groups"
            >
              <div
                className="w-0.5 rounded-full"
                style={{
                  height: embedded ? "2.25rem" : "2.75rem",
                  backgroundColor: VS.strokeSoft,
                }}
              />
            </div>
            {typeof onChooseRight === "function" ? (
              <button
                type="button"
                onClick={onChooseRight}
                disabled={choicesDisabled}
                className={`${zoneBtnClass} hover:-translate-y-0.5 hover:brightness-105 active:translate-y-0 focus-visible:ring-violet-400/80`}
                aria-label="Choose right side"
                title="Choose right side"
              >
                <CrosswalkHalf
                  embedded={embedded}
                  group={scenario.right}
                  side="right"
                  legalLabelSide="end"
                  showHudLabels={embedded ? !portaledHud : undefined}
                />
              </button>
            ) : (
              <CrosswalkHalf
                embedded={embedded}
                group={scenario.right}
                side="right"
                legalLabelSide="end"
                showHudLabels={embedded ? !portaledHud : undefined}
              />
            )}
          </div>

          <div
            className="relative z-[5] h-11 w-full shrink-0 overflow-hidden rounded-b-md border-x-2 border-b-2 shadow-[inset_0_3px_10px_rgba(0,0,0,0.18)] sm:h-12"
            style={{
              borderColor: VS.strokeSoft,
              backgroundImage: [
                `linear-gradient(to right, rgba(8,15,28,0.22) 0%, rgba(8,15,28,0.22) calc(${laneSplit}% - 1px), rgba(120,136,158,0.14) calc(${laneSplit}% + 1px), rgba(120,136,158,0.14) 100%)`,
                `repeating-linear-gradient(90deg, ${VS.crosswalkWhite} 0px, ${VS.crosswalkWhite} 16px, ${VS.asphalt} 16px, ${VS.asphalt} 30px)`,
                `linear-gradient(to bottom, rgba(255,255,255,0.14) 0%, transparent 42%)`,
              ].join(", "),
            }}
            aria-hidden
          >
            <div
              className="pointer-events-none absolute inset-y-0 w-[3px]"
              style={{
                left: `${laneSplit}%`,
                backgroundColor: `${VS.laneYellow}dd`,
                boxShadow: `0 0 0 1px rgba(0,0,0,0.25)`,
              }}
            />
          </div>
        </div>

        {embedded && (
          <p
            className="relative z-10 mx-0.5 pb-0.5 pt-1 text-center text-[7px] font-semibold uppercase tracking-widest opacity-80 sm:mx-1 sm:text-[8px]"
            style={{ color: VS.stroke }}
          >
            Right lane · centerline on your left
          </p>
        )}
      </div>

      {!embedded && (
        <p
          className="border-t px-3 py-2 text-center text-[10px] sm:text-[11px]"
          style={{
            borderColor: `${VS.strokeSoft}88`,
            background: `${VS.cloudLight}66`,
            color: VS.stroke,
          }}
        >
          Zebra crosswalk in view · Green = legal · Orange dashed = jaywalking · Right lane
        </p>
      )}

      {portaledHud && (
        <WindshieldHudMirror scenario={scenario} mountNode={cockpitLabelLayer} />
      )}
    </div>
  );
}
