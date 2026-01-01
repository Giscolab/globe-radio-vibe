// Component - FallbackVisualizer: Simulated audio visualization when CORS blocks WebAudio
import { useEffect, useState, useRef } from 'react';

interface FallbackVisualizerProps {
  isPlaying: boolean;
  mode?: 'bars' | 'mini';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZES = {
  sm: { bars: 16, height: 24, barWidth: 2, gap: 1 },
  md: { bars: 32, height: 48, barWidth: 3, gap: 2 },
  lg: { bars: 64, height: 96, barWidth: 4, gap: 2 },
};

/**
 * Fallback visualizer that simulates audio bars when WebAudio analysis
 * is blocked due to CORS restrictions. Uses sine waves with noise
 * to create a natural-looking animation.
 */
export function FallbackVisualizer({
  isPlaying,
  mode = 'bars',
  size = 'sm',
  className = '',
}: FallbackVisualizerProps) {
  const config = SIZES[size];
  const [barValues, setBarValues] = useState<number[]>(() => 
    Array(config.bars).fill(0).map(() => Math.random() * 0.3)
  );
  const frameRef = useRef<number>(0);
  const timeRef = useRef<number>(0);

  useEffect(() => {
    if (!isPlaying) {
      // Fade out
      setBarValues(prev => prev.map(v => v * 0.9));
      return;
    }

    let animationId: number;
    
    const animate = () => {
      timeRef.current += 0.05;
      const time = timeRef.current;
      
      setBarValues(prev => prev.map((_, i) => {
        // Create wave patterns with multiple frequencies
        const wave1 = Math.sin(time * 2 + i * 0.3) * 0.3;
        const wave2 = Math.sin(time * 3.7 + i * 0.5) * 0.2;
        const wave3 = Math.sin(time * 1.3 + i * 0.15) * 0.15;
        
        // Add subtle noise
        const noise = (Math.random() - 0.5) * 0.1;
        
        // Combine and normalize (0-1 range)
        const value = 0.4 + wave1 + wave2 + wave3 + noise;
        return Math.max(0.1, Math.min(1, value));
      }));
      
      animationId = requestAnimationFrame(animate);
    };

    animationId = requestAnimationFrame(animate);
    
    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [isPlaying, config.bars]);

  if (mode === 'mini') {
    return (
      <div className={`flex items-center gap-1 ${className}`}>
        {[0.3, 0.6, 1, 0.6, 0.3].map((multiplier, i) => (
          <div
            key={i}
            className="w-1 rounded-full bg-primary/70 transition-all duration-100"
            style={{
              height: `${Math.max(4, barValues[i % barValues.length] * 20 * multiplier)}px`,
              opacity: isPlaying ? 0.6 + barValues[i % barValues.length] * 0.4 : 0.3,
            }}
          />
        ))}
      </div>
    );
  }

  // Default: bars mode
  return (
    <div 
      className={`flex items-end ${className}`}
      style={{ height: config.height, gap: config.gap }}
    >
      {barValues.map((value, i) => (
        <div
          key={i}
          className="rounded-full bg-primary/70 transition-all duration-75"
          style={{
            width: config.barWidth,
            height: `${Math.max(4, value * config.height)}px`,
            opacity: isPlaying ? 0.5 + value * 0.5 : 0.3,
          }}
        />
      ))}
    </div>
  );
}
