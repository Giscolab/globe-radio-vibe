// Component - AudioVisualizer: Real-time audio visualization
import { forwardRef, useMemo } from 'react';

interface AudioVisualizerProps {
  fft: Uint8Array;
  volume: number;
  peak: boolean;
  silent: boolean;
  mode?: 'bars' | 'circle' | 'wave' | 'mini';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZES = {
  sm: { bars: 16, height: 24, barWidth: 2, gap: 1 },
  md: { bars: 32, height: 48, barWidth: 3, gap: 2 },
  lg: { bars: 64, height: 96, barWidth: 4, gap: 2 },
};

export const AudioVisualizer = forwardRef<HTMLDivElement, AudioVisualizerProps>(
  function AudioVisualizer({
    fft,
    volume,
    peak,
    silent,
    mode = 'bars',
    size = 'sm',
    className = '',
  }, ref) {
  const config = SIZES[size];
  
  // Sample FFT data to match bar count
  const barValues = useMemo(() => {
    const values: number[] = [];
    const step = Math.floor(fft.length / config.bars);
    
    for (let i = 0; i < config.bars; i++) {
      const index = i * step;
      // Average a few bins for smoother visualization
      let sum = 0;
      for (let j = 0; j < step && index + j < fft.length; j++) {
        sum += fft[index + j];
      }
      values.push((sum / step) / 255);
    }
    return values;
  }, [fft, config.bars]);
  
  if (mode === 'mini') {
    return (
      <MiniVisualizer 
        volume={volume} 
        peak={peak} 
        silent={silent} 
        className={className} 
      />
    );
  }
  
  if (mode === 'circle') {
    return (
      <CircleVisualizer 
        barValues={barValues} 
        volume={volume} 
        peak={peak}
        size={size}
        className={className}
      />
    );
  }
  
  if (mode === 'wave') {
    return (
      <WaveVisualizer 
        barValues={barValues}
        height={config.height}
        className={className}
      />
    );
  }
  
    // Default: bars mode
    return (
      <div 
        ref={ref}
        className={`flex items-end gap-[${config.gap}px] ${className}`}
        style={{ height: config.height, gap: config.gap }}
      >
        {barValues.map((value, i) => (
          <div
            key={i}
            className={`rounded-full transition-all duration-75 ${
              peak ? 'bg-accent' : 'bg-primary'
            }`}
            style={{
              width: config.barWidth,
              height: `${Math.max(4, value * config.height)}px`,
              opacity: silent ? 0.3 : 0.7 + value * 0.3,
            }}
          />
        ))}
      </div>
    );
  }
);

// Mini visualizer for compact spaces
function MiniVisualizer({ 
  volume, 
  peak, 
  silent,
  className = '' 
}: { 
  volume: number; 
  peak: boolean; 
  silent: boolean;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {[0.3, 0.6, 1, 0.6, 0.3].map((multiplier, i) => (
        <div
          key={i}
          className={`w-1 rounded-full transition-all duration-100 ${
            peak ? 'bg-accent' : 'bg-primary'
          }`}
          style={{
            height: `${Math.max(4, volume * 20 * multiplier)}px`,
            opacity: silent ? 0.3 : 0.6 + volume * 0.4,
          }}
        />
      ))}
    </div>
  );
}

// Circle visualizer for station cards
function CircleVisualizer({ 
  barValues, 
  volume, 
  peak,
  size,
  className = '' 
}: { 
  barValues: number[]; 
  volume: number; 
  peak: boolean;
  size: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const dimensions = size === 'sm' ? 40 : size === 'md' ? 60 : 80;
  const radius = dimensions / 2 - 8;
  const bars = barValues.slice(0, 16); // Limit bars for circle
  
  return (
    <div 
      className={`relative ${className}`}
      style={{ width: dimensions, height: dimensions }}
    >
      {/* Glow effect on peak */}
      <div 
        className={`absolute inset-0 rounded-full transition-all duration-150 ${
          peak ? 'bg-accent/30 scale-110' : 'bg-transparent scale-100'
        }`}
      />
      
      {/* Pulsing circle based on volume */}
      <div 
        className="absolute inset-0 rounded-full border-2 border-primary/50 transition-transform duration-100"
        style={{ transform: `scale(${1 + volume * 0.15})` }}
      />
      
      {/* Center volume indicator */}
      <div 
        className="absolute inset-2 rounded-full bg-primary/20 flex items-center justify-center"
        style={{ transform: `scale(${0.5 + volume * 0.5})` }}
      >
        <div 
          className={`w-2 h-2 rounded-full ${peak ? 'bg-accent' : 'bg-primary'}`}
        />
      </div>
    </div>
  );
}

// Wave visualizer 
function WaveVisualizer({ 
  barValues, 
  height,
  className = '' 
}: { 
  barValues: number[];
  height: number;
  className?: string;
}) {
  const points = barValues.map((value, i) => {
    const x = (i / (barValues.length - 1)) * 100;
    const y = 50 - value * 40; // Center line at 50%
    return `${x},${y}`;
  }).join(' ');
  
  const mirrorPoints = barValues.map((value, i) => {
    const x = (i / (barValues.length - 1)) * 100;
    const y = 50 + value * 40;
    return `${x},${y}`;
  }).reverse().join(' ');
  
  return (
    <svg 
      viewBox="0 0 100 100" 
      className={`${className}`}
      style={{ height }}
      preserveAspectRatio="none"
    >
      {/* Wave fill */}
      <polygon
        points={`0,50 ${points} 100,50 ${mirrorPoints}`}
        className="fill-primary/30"
      />
      {/* Wave line */}
      <polyline
        points={points}
        className="stroke-primary fill-none"
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
