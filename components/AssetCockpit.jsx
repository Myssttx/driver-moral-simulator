"use client";

import { useState } from "react";
import { VS } from "@/lib/vectorSceneTheme";
import { CockpitLabelLayerContext } from "@/components/CockpitLabelLayerContext";

const WINDSHIELD_SLOT = {
  left: "7%",
  right: "7%",
  top: "3.5%",
  height: "47%",
};

/**
 * Vector cockpit from your project file: interior-only SVG over the game crosswalk.
 * Windshield area matches viewBox 0 0 675 450 (Illustrator export).
 */
export default function AssetCockpit({ children }) {
  const [labelLayerEl, setLabelLayerEl] = useState(null);

  return (
    <CockpitLabelLayerContext.Provider value={labelLayerEl}>
      <div
        className="relative mx-auto w-full max-w-5xl overflow-hidden rounded-b-xl border-2 shadow-2xl"
        style={{
          aspectRatio: "675 / 450",
          maxHeight: "min(84vh, 920px)",
          borderColor: `${VS.stroke}cc`,
          background: `linear-gradient(180deg, ${VS.buildingRoof} 0%, #4a5568 35%, #3d4450 100%)`,
        }}
      >
        {/* Scene through the glass — drawn by CrosswalkVista (no stacked gradient “block”) */}
        <div
          className="absolute z-0 overflow-hidden bg-transparent"
          style={WINDSHIELD_SLOT}
        >
          <div className="h-full min-h-0 w-full">{children}</div>
        </div>

        <img
          src="/cockpit-overlay.svg"
          alt=""
          className="pointer-events-none absolute inset-0 z-10 h-full w-full select-none"
          draggable={false}
        />

        {/* HUD pills above the SVG overlay (same box as scene) so dash art does not cover them */}
        <div
          ref={setLabelLayerEl}
          className="pointer-events-none absolute z-[30] overflow-visible"
          style={WINDSHIELD_SLOT}
          aria-hidden
        />
      </div>
    </CockpitLabelLayerContext.Provider>
  );
}
