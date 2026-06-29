"use client";

export default function RasterSprite({ src, className = "", title }) {
  return (
    <img
      src={src}
      alt=""
      draggable={false}
      className={`pointer-events-none h-auto max-h-full w-auto max-w-full select-none object-contain object-bottom ${className}`}
      title={title}
    />
  );
}
