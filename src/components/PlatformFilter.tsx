import React from 'react';
import { Monitor } from 'lucide-react';

const PLATFORMS = [
  { id: 'Windows', label: 'Windows', color: '#00F5FF' },
  { id: 'macOS', label: 'macOS', color: '#FF00FF' },
  { id: 'Linux', label: 'Linux', color: '#00FF88' },
  { id: 'iOS', label: 'iOS', color: '#8B5CF6' },
  { id: 'Android', label: 'Android', color: '#00FF88' },
  { id: 'Web', label: 'Web', color: '#FFD700' },
];

interface PlatformFilterProps {
  selected: Set<string>;
  onChange: (platforms: Set<string>) => void;
}

const PlatformFilter: React.FC<PlatformFilterProps> = ({ selected, onChange }) => {
  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    onChange(next);
  };

  const clearAll = () => onChange(new Set());

  return (
    <div className="bg-[#1A1A1A]/80 border border-[#FFD700]/10 rounded-xl p-3">
      <h3 className="text-xs font-semibold uppercase tracking-widest text-[#FFD700]/50 mb-2 px-2">
        Platforms
      </h3>

      <button
        onClick={clearAll}
        className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-r-lg text-sm transition-all duration-200 ${
          selected.size === 0
            ? 'border-l-2 border-[#FFD700] bg-[#FFD700]/10 text-[#FFD700]'
            : 'border-l-2 border-transparent text-gray-400 hover:bg-white/5 hover:text-gray-200'
        }`}
      >
        <Monitor className="w-4 h-4 flex-shrink-0" />
        <span className="truncate">All Platforms</span>
      </button>

      <div className="h-px bg-[#FFD700]/5 my-1.5" />

      <div className="space-y-0.5">
        {PLATFORMS.map((p) => {
          const isActive = selected.has(p.id);
          return (
            <button
              key={p.id}
              onClick={() => toggle(p.id)}
              className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-r-lg text-sm transition-all duration-200 ${
                isActive
                  ? 'border-l-2 bg-white/5'
                  : 'border-l-2 border-transparent text-gray-400 hover:bg-white/5 hover:text-gray-200'
              }`}
              style={isActive ? { borderColor: p.color, color: p.color } : undefined}
            >
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{
                  backgroundColor: p.color,
                  boxShadow: isActive ? `0 0 8px ${p.color}80` : 'none',
                }}
              />
              <span className="truncate flex-1 text-left">{p.label}</span>
              {isActive && (
                <span className="text-[0.6rem] opacity-60">ON</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default PlatformFilter;
