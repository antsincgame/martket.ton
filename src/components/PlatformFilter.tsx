import React from 'react';
import { Monitor } from 'lucide-react';

const PLATFORMS = [
  { id: 'Windows', label: 'Windows', color: '#4A9EAA' },
  { id: 'macOS', label: 'macOS', color: '#8B5A8B' },
  { id: 'Linux', label: 'Linux', color: '#4A8B5A' },
  { id: 'iOS', label: 'iOS', color: '#6B5A8B' },
  { id: 'Android', label: 'Android', color: '#4A8B5A' },
  { id: 'Web', label: 'Web', color: '#8B7A3A' },
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
    <div className="bg-[#111]/80 border border-white/5 rounded-xl p-3">
      <h3 className="text-[0.65rem] font-semibold uppercase tracking-widest text-gray-500 mb-2 px-2">
        Platforms
      </h3>

      <button
        onClick={clearAll}
        className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-r-lg text-sm transition-all duration-200 ${
          selected.size === 0
            ? 'border-l-2 border-gray-500 bg-white/[0.04] text-gray-300'
            : 'border-l-2 border-transparent text-gray-500 hover:bg-white/[0.03] hover:text-gray-300'
        }`}
      >
        <Monitor className="w-4 h-4 flex-shrink-0" />
        <span className="truncate">All Platforms</span>
      </button>

      <div className="h-px bg-white/5 my-1.5" />

      <div className="space-y-0.5">
        {PLATFORMS.map((p) => {
          const isActive = selected.has(p.id);
          return (
            <button
              key={p.id}
              onClick={() => toggle(p.id)}
              className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-r-lg text-sm transition-all duration-200 ${
                isActive
                  ? 'border-l-2 bg-white/[0.04]'
                  : 'border-l-2 border-transparent text-gray-500 hover:bg-white/[0.03] hover:text-gray-400'
              }`}
              style={isActive ? { borderColor: p.color, color: p.color } : undefined}
            >
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: p.color, opacity: isActive ? 1 : 0.4 }}
              />
              <span className="truncate flex-1 text-left">{p.label}</span>
              {isActive && (
                <span className="text-[0.55rem] opacity-40">ON</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default PlatformFilter;
