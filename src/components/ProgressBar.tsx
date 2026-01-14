import { useEffect, useState, useRef } from 'react';
import { Loader2 } from 'lucide-react';

interface ProgressBarProps {
  stage: 'upload' | 'extraction' | 'analysis' | 'formatting' | null;
}

// ⏱️ TIME-BASED SIMULATED PROGRESS
// Backend doesn't stream progress, so we simulate smooth continuous movement
// This creates a better UX than freezing at arbitrary percentages
const ESTIMATED_TOTAL_DURATION = 75000; // 75 seconds estimated total (conservative)

export default function ProgressBar({ stage }: ProgressBarProps) {
  const [progress, setProgress] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(75);
  const startTimeRef = useRef<number>(Date.now());
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!stage) {
      setProgress(0);
      setRemainingSeconds(75);
      return;
    }

    // Reset timer when processing starts
    if (stage === 'upload') {
      startTimeRef.current = Date.now();
    }

    // ✅ CONTINUOUS PROGRESS ANIMATION
    // Progress moves smoothly from 0% → 95%, never freezing
    // Only completes (100%) when backend responds successfully
    intervalRef.current = setInterval(() => {
      const elapsedMs = Date.now() - startTimeRef.current;
      const elapsedSeconds = Math.floor(elapsedMs / 1000);
      
      // Calculate progress percentage (0% → 95%)
      // Fast progress early, slower as it approaches 95%
      let calculatedProgress: number;
      
      if (elapsedMs < 30000) {
        // 0-30s: 0% → 60% (fast initial progress)
        calculatedProgress = (elapsedMs / 30000) * 60;
      } else if (elapsedMs < 50000) {
        // 30-50s: 60% → 80% (moderate progress)
        calculatedProgress = 60 + ((elapsedMs - 30000) / 20000) * 20;
      } else {
        // 50s+: 80% → 95% (slow approach, never reaches 95% until almost done)
        const remaining = Math.min((elapsedMs - 50000) / 25000, 1);
        calculatedProgress = 80 + (remaining * 15);
      }
      
      // ⚠️ NEVER exceed 95% while waiting for backend
      const cappedProgress = Math.min(calculatedProgress, 95);
      setProgress(cappedProgress);
      
      // Calculate remaining time (countdown)
      const remainingMs = Math.max(0, ESTIMATED_TOTAL_DURATION - elapsedMs);
      const remainingSec = Math.ceil(remainingMs / 1000);
      setRemainingSeconds(remainingSec);
      
    }, 100); // Update every 100ms for smooth animation

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [stage]);

  // ✅ COMPLETION LOGIC
  // When formatting stage is reached, we're close to done
  // Complete to 100% quickly
  useEffect(() => {
    if (stage === 'formatting') {
      const timer = setTimeout(() => {
        setProgress(100);
        setRemainingSeconds(0);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [stage]);

  if (!stage) return null;

  // User-friendly messages based on stage
  const getMessage = () => {
    switch (stage) {
      case 'upload':
        return 'Uploading and validating file';
      case 'extraction':
        return 'Extracting text from PDF';
      case 'analysis':
        return 'Analyzing content with AI';
      case 'formatting':
        return 'Generating insights and formatting results';
      default:
        return 'Processing…';
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto mt-6 space-y-3">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center space-x-2">
          <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
          <span className="font-medium text-gray-700">{getMessage()}</span>
        </div>
        {remainingSeconds > 0 && progress < 100 && (
          <span className="text-gray-500 text-xs">
            ≈ {remainingSeconds}s remaining
          </span>
        )}
      </div>
      
      <div className="relative w-full h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-300 ease-out rounded-full"
          style={{ width: `${progress}%` }}
        >
          <div className="absolute inset-0 bg-white/20 animate-pulse" />
        </div>
      </div>
      
      <div className="flex justify-between text-xs text-gray-500">
        <span>{Math.round(progress)}% complete</span>
        <span className="font-medium">{progress < 100 ? 'Processing...' : 'Done!'}</span>
      </div>
    </div>
  );
}
