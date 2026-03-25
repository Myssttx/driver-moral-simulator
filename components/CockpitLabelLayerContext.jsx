"use client";

import { createContext, useContext } from "react";

/** DOM node above cockpit SVG; windshield HUD labels portal here when set. */
export const CockpitLabelLayerContext = createContext(null);

export function useCockpitLabelLayer() {
  return useContext(CockpitLabelLayerContext);
}
