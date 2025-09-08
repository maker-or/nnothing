"use client";

import React from "react";
import { useQuery } from "convex/react";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

interface Stage {
  title: string;
  purpose: string;
  include: string[];
  outcome: string;
  discussion_prompt: string;
}

interface CourseCanvasProps {
  stages: Stage[];
  courseId: Id<"Course">;
}

// Cubic Bézier for gentle waves
const generateCurvedPath = (
  start: { x: number; y: number },
  end: { x: number; y: number }
) => {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const cp1x = start.x + dx * 0.35;
  const cp1y = start.y + dy * 0.35 + 30;
  const cp2x = end.x - dx * 0.35;
  const cp2y = end.y - dy * 0.35 - 30;
  return `M ${start.x} ${start.y} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${end.x} ${end.y}`;
};

// Wave-like horizontal layout
const generateStagePositions = (stageCount: number, containerWidth: number) => {
  const positions: { x: number; y: number }[] = [];
  const spacing = containerWidth / (stageCount + 1);
  const centerY = 300;
  const waveHeight = 60;
  for (let i = 0; i < stageCount; i++) {
    const x = spacing * (i + 1);
    const waveOffset =
      stageCount > 1
        ? Math.sin((i / (stageCount - 1)) * Math.PI) * waveHeight
        : 0;
    const y = centerY + waveOffset;
    positions.push({ x, y });
  }
  return positions;
};

// Linear interpolation between two points (0..1)
const lerpPoint = (
  a: { x: number; y: number },
  b: { x: number; y: number },
  t: number
) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

const StageIsland: React.FC<{
  stage: Stage;
  index: number;
  position: { x: number; y: number };
  onClick: () => void;
  isReady?: boolean;
}> = ({ stage, index, position, onClick, isReady = false }) => {
  return (
    <g
      onClick={onClick}
      style={{ cursor: "pointer" }}
      transform={`translate(${position.x}, ${position.y})`}
    >
      {/* Soft shadow */}
      <rect
        x={-58}
        y={-58}
        width={116}
        height={116}
        rx={22}
        fill="black"
        opacity={0.35}
        filter="url(#nodeShadow)"
      />

      {/* Island body with glass/gradient stroke */}
      <rect
        x={-56}
        y={-56}
        width={112}
        height={112}
        rx={20}
        fill={isReady ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.04)"}
        stroke="url(#panelStroke)"
        strokeWidth={1.5}
      />

      {/* Inner shine */}
      <rect
        x={-56}
        y={-56}
        width={112}
        height={112}
        rx={20}
        fill="url(#innerShine)"
        opacity={0.18}
      />

      {/* Subtle rim light */}
      <rect
        x={-56}
        y={-56}
        width={112}
        height={112}
        rx={20}
        fill="none"
        stroke="rgba(255,255,255,0.2)"
        strokeWidth={0.75}
      />

      {/* Tiny creation spark */}
      {!isReady && (
        <rect
          x={36}
          y={-44}
          width={12}
          height={12}
          transform={`rotate(45 ${42} ${-38})`}
          fill="url(#sparkGrad)"
          filter="url(#glow)"
          opacity={0.9}
        />
      )}

      {/* Stage number */}
      <text
        className="select-none"
        x={0}
        y={-4}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="white"
        fontSize={32}
        fontWeight="700"
      >
        {index + 1}
      </text>

      {/* Title */}
      <text
        className="select-none"
        x={0}
        y={72}
        textAnchor="middle"
        fill="rgba(255,255,255,0.7)"
        fontSize={14}
      >
        {stage.title.length > 14
          ? `${stage.title.substring(0, 14)}...`
          : stage.title}
      </text>
    </g>
  );
};

const CourseCanvas: React.FC<CourseCanvasProps> = ({ stages, courseId }) => {
  const stageIds = useQuery(api.stage.getstageIds, { courseId });
  const router = useRouter();

  const handleStageClick = (stageIndex: number) => {
    if (stageIds?.stageIds?.[stageIndex]) {
      router.push(`/learning/stage/${courseId}/${stageIds.stageIds[stageIndex]}`);
    } else {
      // Stage not ready yet
      console.log(`Stage ${stageIndex + 1} is still being created...`);
    }
  };

  const handleBack = () => router.push("/learning/library");

  const width = 1200;
  const height = 600;
  const stagePositions = generateStagePositions(stages.length, width);

  const readyCount = stageIds?.stageIds?.length ?? 0;
  const pct = Math.max(
    0,
    Math.min(100, Math.round((readyCount / Math.max(1, stages.length)) * 100))
  );

  return (
    <main className="relative min-h-[100svh] w-full bg-black">
      {/* Film grain */}
      <div
        className="absolute inset-0 z-10 opacity-20"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundRepeat: "repeat",
          backgroundSize: "256px 256px",
          pointerEvents: "none",
        }}
      />

      {/* Vignette */}
      <div
        className="absolute inset-0 z-10"
        style={{
          background:
            "radial-gradient(60% 60% at 50% 40%, rgba(255,255,255,0.05) 0%, rgba(0,0,0,0) 60%), radial-gradient(80% 80% at 50% 50%, rgba(0,0,0,0) 60%, rgba(0,0,0,0.6) 100%)",
          pointerEvents: "none",
        }}
      />

      {/* Back + Title */}
      <div className="absolute top-6 left-6 z-30 flex items-center gap-4">
        <button
          onClick={handleBack}
          className="rounded-lg border border-white/20 bg-black p-3 text-white backdrop-blur-md transition-all duration-200 hover:bg-white/10"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="font-serif text-4xl italic text-white">Your Course</h1>
      </div>

      {/* Canvas */}
      <div className="relative z-20 h-full w-full">
        <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%">
          <defs>
            {/* Neon glow for strokes / sparks */}
            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {/* Soft node shadow */}
            <filter id="nodeShadow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="8" stdDeviation="12" floodOpacity="0.35" />
            </filter>

            {/* Path stroke gradient */}
            <linearGradient id="pathStroke" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="rgba(255,255,255,0.25)" />
              <stop offset="50%" stopColor="rgba(255,255,255,0.6)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0.25)" />
            </linearGradient>

            {/* Panel rim gradient */}
            <linearGradient id="panelStroke" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="rgba(255,255,255,0.35)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0.12)" />
            </linearGradient>

            {/* Inner shine gradient */}
            <linearGradient id="innerShine" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="rgba(255,255,255,0.6)" />
              <stop offset="35%" stopColor="rgba(255,255,255,0.05)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0.0)" />
            </linearGradient>



          </defs>

          {/* Connectors */}
          <g>
            {stagePositions.slice(0, -1).map((p, i) => {
              const q = stagePositions[i + 1]!;
              const d = generateCurvedPath(p, q);
              const s1 = lerpPoint(p, q, 0.15);
              const s2 = lerpPoint(p, q, 0.85);

              return (
                <g key={`link-${i}`}>
                  {/* Outer glow */}
                  <path
                    d={d}
                    fill="none"
                    stroke="rgba(255,255,255,0.12)"
                    strokeWidth={7}
                    filter="url(#glow)"
                  />
                  {/* Main gradient stroke with shimmer */}
                  <path
                    d={d}
                    fill="none"
                    stroke="url(#pathStroke)"
                    strokeWidth={2.25}
                    strokeLinecap="round"
                    markerEnd="url(#arrowhead)"
                    style={{ strokeDasharray: "8 14" }}
                  >
                    <animate
                      attributeName="stroke-dashoffset"
                      from="0"
                      to="-300"
                      dur="6s"
                      repeatCount="indefinite"
                    />
                  </path>
                  {/* Connection sparks */}
                  <rect
                    x={s1.x - 7}
                    y={s1.y - 7}
                    width={14}
                    height={14}
                    transform={`rotate(45 ${s1.x} ${s1.y})`}
                    fill="url(#sparkGrad)"
                    filter="url(#glow)"
                    opacity={0.9}
                  />
                  <rect
                    x={s2.x - 6}
                    y={s2.y - 6}
                    width={12}
                    height={12}
                    transform={`rotate(45 ${s2.x} ${s2.y})`}
                    fill="url(#sparkGrad)"
                    filter="url(#glow)"
                    opacity={0.75}
                  />
                </g>
              );
            })}
          </g>

          {/* Islands */}
          <g>
            {stages.map((stage, index) => {
              const isReady = !!stageIds?.stageIds?.[index];
              return (
                <StageIsland
                  key={index}
                  stage={stage}
                  index={index}
                  position={stagePositions[index]!}
                  onClick={() => handleStageClick(index)}
                  isReady={isReady}
                />
              );
            })}
          </g>
        </svg>
      </div>

      {/* Bottom progress + status */}
      <div className="absolute bottom-8 left-1/2 z-20 w-[min(820px,90vw)] -translate-x-1/2">
        <div className="rounded-xl border border-white/15 bg-white/5 p-2 backdrop-blur">
          <div className="h-2.5 overflow-hidden rounded-md bg-white/10">
            <div
              className="h-full rounded-md"
              style={{
                width: `${pct}%`,
                background:
                  "linear-gradient(90deg, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0.7) 50%, rgba(255,255,255,0.25) 100%)",
                boxShadow:
                  "0 0 12px rgba(255,255,255,0.45), inset 0 0 8px rgba(255,255,255,0.2)",
                transition: "width 600ms ease",
              }}
            />
          </div>
          <p className="mt-2 text-center text-sm text-white/70">
            {readyCount === stages.length
              ? "All stages ready! Click any stage to explore."
              : `Creating content... ${readyCount}/${stages.length} stages ready`}
          </p>
        </div>
      </div>
    </main>
  );
};

export default CourseCanvas;
