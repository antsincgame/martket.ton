import { useState, useCallback } from 'react';
import { Copy, Check } from 'lucide-react';

interface CopyButtonProps {
  text: string;
  label?: string;
  className?: string;
}

export function CopyButton({ text, label, className = '' }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      className={`inline-flex items-center gap-1.5 text-xs transition-all duration-200 ${
        copied
          ? 'text-[#00FF88]'
          : 'text-[#666] hover:text-[#FFD700]'
      } ${className}`}
      title={copied ? 'Copied!' : 'Copy'}
    >
      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      {label && <span>{copied ? 'Copied!' : label}</span>}
    </button>
  );
}

export function CopyableText({ text, truncate = true }: { text: string; truncate?: boolean }) {
  const display = truncate && text.length > 16
    ? `${text.slice(0, 8)}...${text.slice(-6)}`
    : text;

  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-sm">
      <span className="text-[#00F5FF]">{display}</span>
      <CopyButton text={text} />
    </span>
  );
}
