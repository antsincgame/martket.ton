import React, { useState } from 'react';
import { Gem } from 'lucide-react';

interface SecretTriggerProps {
  onActivate: () => void;
}

const SecretTrigger: React.FC<SecretTriggerProps> = ({ onActivate }) => {
  const [clickCount, setClickCount] = useState(0);
  const [isGlowing, setIsGlowing] = useState(false);

  const handleClick = () => {
    const newCount = clickCount + 1;
    setClickCount(newCount);

    if (newCount >= 7) {
      setIsGlowing(true);
      setTimeout(() => {
        onActivate();
        setClickCount(0);
        setIsGlowing(false);
      }, 1000);
    } else if (newCount === 1) {
      // Reset count after 3 seconds if not completed
      setTimeout(() => {
        setClickCount(0);
      }, 3000);
    }
  };

  return (
    <div 
      onClick={handleClick}
      className={`fixed bottom-4 right-4 w-12 h-12 cursor-pointer transition-all duration-500 ${
        isGlowing 
          ? 'animate-pulse scale-150 brightness-200' 
          : clickCount > 0 
            ? 'scale-110 brightness-125' 
            : 'opacity-30 hover:opacity-60'
      }`}
      style={{ zIndex: 9998 }}
      title={clickCount > 0 ? `${7 - clickCount} more clicks to access White Tara realm` : 'Sacred gem of White Tara'}
    >
      <div className={`w-full h-full bg-mystical-gradient rounded-full flex items-center justify-center ${
        isGlowing ? 'shadow-2xl shadow-purple-500/80' : 'shadow-lg shadow-purple-500/30'
      }`}>
        <Gem className={`w-6 h-6 text-white ${isGlowing ? 'animate-spin' : 'animate-sparkle'}`} />
      </div>
      
      {/* Sacred symbols that appear during activation */}
      {clickCount > 0 && (
        <div className="absolute inset-0 pointer-events-none">
          {[...Array(clickCount)].map((_, i) => (
            <div
              key={i}
              className="absolute text-purple-300 text-xs animate-ping"
              style={{
                top: `${Math.random() * 100}%`,
                left: `${Math.random() * 100}%`,
                animationDelay: `${i * 0.2}s`
              }}
            >
              {['🪷', '☸️', '🕉️', '✨', '🌟', '💎', '🔮'][i]}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SecretTrigger;