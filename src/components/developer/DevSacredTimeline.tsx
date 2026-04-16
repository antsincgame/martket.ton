import { memo, useMemo } from 'react';
import { motion } from 'framer-motion';
import type { PublicDeveloperProfile } from '../../domain/marketplace/types';
import { buildAchievements } from './achievements';
import SacredDivider from './SacredDivider';

interface DevSacredTimelineProps {
  profile: PublicDeveloperProfile;
}

const DevSacredTimeline = memo(({ profile }: DevSacredTimelineProps) => {
  const achievements = useMemo(() => buildAchievements(profile), [profile]);

  if (achievements.length === 0) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
    >
      <SacredDivider label="Sacred Path" color="#8B5CF6" icon="⟁" />

      <div className="relative pl-6 sm:pl-10">
        {/* Vertical line */}
        <svg
          aria-hidden
          className="absolute left-2 sm:left-5 top-2 bottom-2 w-[2px] overflow-visible"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="timelineGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FFD700" stopOpacity="0.8" />
              <stop offset="50%" stopColor="#8B5CF6" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#00F5FF" stopOpacity="0.8" />
            </linearGradient>
          </defs>
          <motion.line
            x1="1"
            y1="0"
            x2="1"
            y2="100%"
            stroke="url(#timelineGrad)"
            strokeWidth="2"
            initial={{ pathLength: 0 }}
            whileInView={{ pathLength: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1.4, ease: 'easeOut' }}
          />
        </svg>

        <div className="space-y-6">
          {achievements.map((ach, i) => (
            <motion.div
              key={ach.id}
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.15 + i * 0.15, duration: 0.5 }}
              className="relative"
            >
              {/* Node glyph */}
              <div
                className="absolute -left-6 sm:-left-10 top-3 flex items-center justify-center"
                style={{ width: 44, height: 44, transform: 'translateX(-12px)' }}
              >
                <div
                  className="absolute inset-0 rounded-full blur-md animate-aura-pulse"
                  style={{
                    background: `radial-gradient(circle, ${ach.color}80, transparent 70%)`,
                  }}
                />
                <div
                  className="relative w-9 h-9 rounded-full flex items-center justify-center border-2"
                  style={{
                    borderColor: ach.color,
                    background: '#0D0D1A',
                    boxShadow: `0 0 16px ${ach.color}70`,
                  }}
                >
                  <ach.icon className="w-4 h-4" style={{ color: ach.color }} />
                </div>
              </div>

              {/* Card */}
              <div
                className="ml-6 sm:ml-8 p-4 sm:p-5 rounded-xl border bg-[#0D0D1A]/70 backdrop-blur-sm transition-all duration-300 hover:translate-x-1"
                style={{
                  borderColor: `${ach.color}30`,
                  boxShadow: `inset 0 0 40px ${ach.color}08`,
                }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <h3
                    className="text-sm font-black uppercase tracking-[0.2em]"
                    style={{
                      color: ach.color,
                      textShadow: `0 0 10px ${ach.color}60`,
                    }}
                  >
                    {ach.title}
                  </h3>
                </div>
                <p className="text-gray-400 text-sm leading-relaxed">{ach.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.section>
  );
});

DevSacredTimeline.displayName = 'DevSacredTimeline';

export default DevSacredTimeline;
