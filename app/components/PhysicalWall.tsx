// components/PhysicalWall.tsx
import { getPhysicalWearStyles } from '../lib/wearAlgorithm';

interface WallProps {
  entries: any[];
  onClose: () => void;
}

export function PhysicalWall({ entries, onClose }: WallProps) {
  return (
    <div 
      onClick={onClose}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-md cursor-pointer transition-all duration-500"
    >
      {/* 视网膜延迟聚焦动效 */}
      <style>{`
        @keyframes eyeFocus {
          0% { filter: blur(12px); opacity: 0; transform: scale(0.98); }
          100% { filter: blur(0px); opacity: 1; transform: scale(1); }
        }
        .animate-eye-focus {
          animation: eyeFocus 1.5s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
        }
      `}</style>
      
      <div className="w-full max-w-md p-8 flex flex-col gap-12 animate-eye-focus">
        {entries.map(entry => {
          const wear = getPhysicalWearStyles(entry.timestamp);
          return (
            <div 
              key={entry.id}
              className={`text-neutral-200 tracking-[0.15em] leading-loose ${wear.className}`}
              style={{ opacity: wear.opacity }}
            >
              {entry.content}
            </div>
          );
        })}
      </div>
    </div>
  );
}