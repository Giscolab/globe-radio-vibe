// Ambience Chips - Quick mood-based search filters
import { Moon, Focus, Zap, Leaf, Stars, PartyPopper, Guitar, Mic2 } from 'lucide-react';
import type { AmbienceType } from '@/engine/radio/ai/searchAI';

interface AmbienceChipsProps {
  onSelect: (ambience: AmbienceType) => void;
  selected?: AmbienceType | null;
  disabled?: boolean;
  className?: string;
}

const AMBIENCES: Array<{
  id: AmbienceType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}> = [
  { id: 'chill', label: 'Chill', icon: Leaf, color: 'from-teal-500 to-cyan-500' },
  { id: 'focus', label: 'Focus', icon: Focus, color: 'from-blue-500 to-indigo-500' },
  { id: 'energetic', label: 'Énergique', icon: Zap, color: 'from-orange-500 to-red-500' },
  { id: 'relax', label: 'Détente', icon: Moon, color: 'from-purple-500 to-pink-500' },
  { id: 'night', label: 'Nuit', icon: Stars, color: 'from-slate-600 to-slate-800' },
  { id: 'party', label: 'Party', icon: PartyPopper, color: 'from-pink-500 to-rose-500' },
  { id: 'acoustic', label: 'Acoustique', icon: Guitar, color: 'from-amber-500 to-yellow-600' },
  { id: 'vocal', label: 'Vocal', icon: Mic2, color: 'from-violet-500 to-purple-600' },
];

export function AmbienceChips({ onSelect, selected, disabled, className = '' }: AmbienceChipsProps) {
  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {AMBIENCES.map(({ id, label, icon: Icon, color }) => {
        const isSelected = selected === id;
        
        return (
          <button
            key={id}
            onClick={() => onSelect(id)}
            disabled={disabled}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium
              transition-all duration-200
              ${isSelected 
                ? `bg-gradient-to-r ${color} text-white shadow-lg scale-105` 
                : 'neo-flat hover:neo-pressed text-muted-foreground hover:text-foreground'
              }
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            <Icon className="w-3.5 h-3.5" />
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
