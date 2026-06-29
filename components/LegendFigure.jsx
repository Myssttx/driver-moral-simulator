"use client";

/**
 * Legend-only: identical frame, background, and scale math so every PNG reads the same
 * (fixed height, object-contain, shared panel color).
 */
export default function LegendFigure({ src, wide = false, className = "", imgClassName = "" }) {
  return (
    <div
      className={`mx-auto flex shrink-0 items-end justify-center rounded-lg bg-zinc-950/85 p-2 ring-1 ring-zinc-700/60 ${
        wide
          ? "h-44 w-full max-w-[11.5rem] sm:h-48 sm:max-w-[13rem]"
          : "h-44 w-full max-w-[8.25rem] sm:h-48 sm:max-w-[9rem]"
      } ${className}`}
    >
      <img
        src={src}
        alt=""
        draggable={false}
        className={`pointer-events-none max-h-full max-w-full select-none object-contain object-bottom ${imgClassName}`}
      />
    </div>
  );
}
