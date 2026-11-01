import type { ReactNode } from "react";

/** Color for segments with no category color of their own. */
export const NEUTRAL_SEGMENT_COLOR = "#94a3b8";

/** Sizing shared by a donut's track and arcs. */
export type DonutGeometry = {
  viewBox: number;
  center: number;
  radius: number;
  circumference: number;
};

/** Derives the geometry of a donut drawn in a square view box. */
export function donutGeometry(viewBox: number, radius: number): DonutGeometry {
  return {
    viewBox,
    center: viewBox / 2,
    radius,
    circumference: 2 * Math.PI * radius,
  };
}

type DonutSvgProps = {
  geometry: DonutGeometry;
  strokeWidth: number;
  /** Tailwind stroke class for the background track. */
  trackClassName?: string;
  /** Dash pattern for the background track, such as a placeholder ring. */
  trackDasharray?: string;
  children?: ReactNode;
};

/** Draws a decorative donut track; arcs are passed as children. */
export function DonutSvg({
  geometry: { viewBox, center, radius },
  strokeWidth,
  trackClassName = "stroke-slate-800",
  trackDasharray,
  children,
}: DonutSvgProps) {
  return (
    <svg
      viewBox={`0 0 ${viewBox} ${viewBox}`}
      aria-hidden="true"
      focusable="false"
    >
      <circle
        className={`fill-none ${trackClassName}`}
        cx={center}
        cy={center}
        r={radius}
        strokeWidth={strokeWidth}
        strokeDasharray={trackDasharray}
      />
      {children}
    </svg>
  );
}

type DonutArcProps = {
  geometry: DonutGeometry;
  color: string;
  strokeWidth: number;
  /** Arc length along the ring, in view-box units. */
  length: number;
  /** Distance from the top of the ring to the arc's start. */
  offset?: number;
  linecap?: "round" | "butt";
  className?: string;
};

/** Draws one arc of a donut, measured clockwise from the top. */
export function DonutArc({
  geometry: { center, radius, circumference },
  color,
  strokeWidth,
  length,
  offset = 0,
  linecap,
  className,
}: DonutArcProps) {
  return (
    <circle
      className={className}
      cx={center}
      cy={center}
      r={radius}
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap={linecap}
      strokeDasharray={`${length} ${circumference - length}`}
      strokeDashoffset={-offset}
      transform={`rotate(-90 ${center} ${center})`}
    />
  );
}
