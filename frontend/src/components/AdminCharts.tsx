import React from 'react';
import { AdminCourseItem } from '../types';

interface Segment {
  label: string;
  value: number;
  color: string;
  dotClass: string;
}

export const DonutBreakdownChart: React.FC<{
  title: string;
  subtitle?: string;
  centerLabel: string;
  centerValue: string | number;
  segments: Segment[];
}> = ({ title, subtitle, centerLabel, centerValue, segments }) => {
  const total = segments.reduce((acc, s) => acc + s.value, 0);
  const radius = 52;
  const circumference = 2 * Math.PI * radius;

  const computed = segments.reduce<{
    offset: number;
    items: Array<Segment & { dash: number; startOffset: number; pct: number }>;
  }>(
    (acc, seg) => {
      const pct = total > 0 ? (seg.value / total) * 100 : 0;
      const dash = total > 0 ? (seg.value / total) * circumference : 0;
      const startOffset = acc.offset;
      return {
        offset: acc.offset + dash,
        items: [...acc.items, { ...seg, dash, startOffset, pct }],
      };
    },
    { offset: 0, items: [] }
  ).items;

  return (
    <div className="p-5 rounded-2xl border border-[#AEAC78]/40 bg-[#FFFDF9] dark:bg-[#38322E] shadow-xs flex flex-col justify-between">
      <div>
        <h3 className="text-sm font-bold text-[#4C4541] dark:text-[#FCF0DA]">{title}</h3>
        {subtitle && (
          <p className="text-[11px] text-[#6B625B] dark:text-[#AEAC78] mt-0.5">{subtitle}</p>
        )}
      </div>

      <div className="mt-4 flex flex-col sm:flex-row items-center gap-6">
        <div className="relative w-36 h-36 shrink-0 flex items-center justify-center">
          <svg viewBox="0 0 140 140" className="w-full h-full -rotate-90">
            <circle
              cx="70"
              cy="70"
              r={radius}
              fill="transparent"
              stroke="currentColor"
              strokeWidth="16"
              className="text-[#AEAC78]/20"
            />
            {total > 0 &&
              computed.map((item) =>
                item.value > 0 ? (
                  <circle
                    key={item.label}
                    cx="70"
                    cy="70"
                    r={radius}
                    fill="transparent"
                    stroke={item.color}
                    strokeWidth="16"
                    strokeDasharray={`${item.dash} ${circumference - item.dash}`}
                    strokeDashoffset={-item.startOffset}
                    strokeLinecap="butt"
                    className="transition-all duration-500"
                  />
                ) : null
              )}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
            <span className="text-xl font-black font-mono text-[#4C4541] dark:text-[#FCF0DA]">
              {centerValue}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#AEAC78]">
              {centerLabel}
            </span>
          </div>
        </div>

        <div className="flex-1 w-full space-y-2.5 text-xs">
          {computed.map((item) => (
            <div key={item.label} className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2 font-semibold">
                  <span className={`w-2.5 h-2.5 rounded-full ${item.dotClass}`} />
                  <span>{item.label}</span>
                </span>
                <span className="font-mono text-[11px] font-bold">
                  {item.value}{' '}
                  <span className="text-[#AEAC78] font-normal">({item.pct.toFixed(0)}%)</span>
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-[#AEAC78]/15 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${item.pct}%`, backgroundColor: item.color }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export const CourseActivityBarChart: React.FC<{
  courses: AdminCourseItem[];
}> = ({ courses }) => {
  const topCourses = [...courses]
    .sort((a, b) => b.submission_count - a.submission_count)
    .slice(0, 6);
  const maxSubs = Math.max(1, ...topCourses.map((c) => c.submission_count));

  return (
    <div className="p-5 rounded-2xl border border-[#AEAC78]/40 bg-[#FFFDF9] dark:bg-[#38322E] shadow-xs flex flex-col justify-between">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-[#4C4541] dark:text-[#FCF0DA]">
            Submission Volume by Course
          </h3>
          <p className="text-[11px] text-[#6B625B] dark:text-[#AEAC78] mt-0.5">
            Top active courses ranked by total student submissions
          </p>
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#FCF0DA] dark:bg-[#2C2623] border border-[#AEAC78]/40 text-[#4C4541] dark:text-[#F2C46A]">
          Top {topCourses.length}
        </span>
      </div>

      {topCourses.length === 0 ? (
        <div className="py-12 text-center text-xs text-[#AEAC78]">
          No courses created yet to plot activity.
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {topCourses.map((course) => {
            const widthPct = Math.max(
              course.submission_count > 0 ? 6 : 2,
              Math.round((course.submission_count / maxSubs) * 100)
            );
            return (
              <div key={course.id} className="space-y-1 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 truncate">
                    <span className="font-mono font-bold text-[#4C4541] dark:text-[#F2C46A]">
                      {course.code}
                    </span>{' '}
                    <span className="text-[#6B625B] dark:text-[#FCF0DA]/80 truncate">
                      - {course.name}
                    </span>
                  </div>
                  <div className="shrink-0 font-mono text-[11px] font-bold">
                    {course.submission_count} subs{' '}
                    <span className="text-[#AEAC78] font-normal">({course.class_count} cls)</span>
                  </div>
                </div>
                <div className="h-2.5 w-full rounded-full bg-[#FCF0DA]/70 dark:bg-[#2C2623] border border-[#AEAC78]/20 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#AEAC78] to-[#F2C46A] transition-all duration-500"
                    style={{ width: `${widthPct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
