import { memo, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import SacredDivider from '../developer/SacredDivider';

interface ScriptureDescriptionProps {
  longDescription: string;
  /** Список тэгов — рендерим под описанием. */
  tags: readonly string[];
}

const UNVEIL_THRESHOLD = 640; // символов, после которых появляется fade + кнопка

/**
 * Описание продукта как священное писание:
 * drop-cap, ритуальная типографика, плавное раскрытие длинных текстов.
 */
const ScriptureDescription = memo(({ longDescription, tags }: ScriptureDescriptionProps) => {
  const reduce = useReducedMotion();
  const [expanded, setExpanded] = useState(false);

  const isLong = longDescription.length > UNVEIL_THRESHOLD;

  const { firstChar, rest } = useMemo(() => {
    const trimmed = longDescription.trimStart();
    if (trimmed.length === 0) return { firstChar: '', rest: '' };
    return { firstChar: trimmed[0], rest: trimmed.slice(1) };
  }, [longDescription]);

  return (
    <section aria-label="Описание артефакта" className="relative">
      <SacredDivider label="SCRIPTURE" color="#FFD700" icon="❖" />

      <motion.div
        initial={reduce ? undefined : { opacity: 0, y: 12 }}
        whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.55 }}
        className="relative"
      >
        <div
          className="relative text-gray-300 leading-loose text-[15px] md:text-base whitespace-pre-line max-w-prose"
          style={{
            maxHeight: isLong && !expanded ? 360 : undefined,
            overflow: isLong && !expanded ? 'hidden' : 'visible',
          }}
        >
          {firstChar && (
            <span
              aria-hidden
              className="float-left pr-3 pt-1 font-display font-black leading-none select-none"
              style={{
                fontSize: '4.5rem',
                background: 'linear-gradient(180deg, #FFE066 0%, #FFD700 60%, #F4A836 100%)',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                textShadow: '0 0 20px rgba(255,215,0,0.45)',
              }}
            >
              {firstChar}
            </span>
          )}
          {rest}

          {/* Fade snake-teeth под длинным текстом */}
          {isLong && !expanded && (
            <div
              aria-hidden
              className="pointer-events-none absolute bottom-0 left-0 right-0 h-32"
              style={{
                background:
                  'linear-gradient(180deg, rgba(10,10,15,0) 0%, rgba(10,10,15,0.85) 70%, #0A0A0F 100%)',
              }}
            />
          )}
        </div>

        {isLong && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[#FFD700]/30 bg-[#FFD700]/5 text-[#FFD700] text-[11px] font-black uppercase tracking-[0.25em] hover:bg-[#FFD700]/12 hover:border-[#FFD700]/60 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD700]"
            aria-expanded={expanded}
          >
            {expanded ? 'Fold the Scripture' : 'Unveil the full Scripture'}
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`}
            />
          </button>
        )}
      </motion.div>

      {/* Теги */}
      {tags.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center px-3 py-1 rounded-full text-[11px] font-bold border bg-[#00F5FF]/8 border-[#00F5FF]/35 text-[#00F5FF]"
              style={{ textShadow: '0 0 8px rgba(0,245,255,0.35)' }}
            >
              #{tag}
            </span>
          ))}
        </div>
      )}
    </section>
  );
});

ScriptureDescription.displayName = 'ScriptureDescription';

export default ScriptureDescription;
