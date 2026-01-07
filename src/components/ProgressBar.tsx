import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

interface ProgressBarProps {
  stage: 'upload' | 'extraction' | 'analysis' | 'formatting' | null;
}

// Stage configurations with realistic timing
const STAGE_CONFIG = {
  upload: { progress: 10, message: 'Uploading and validating file', duration: 1000 },
  extraction: { progress: 30, message: 'Extracting text from PDF', duration: 3000 },
  analysis: { progress: 70, message: 'Analyzing content with AI', duration: 25000 },
  formatting: { progress: 95, message: 'Generating insights and formatting results', duration: 3000 }
};

export default function ProgressBar({ stage }: ProgressBarProps) {
  const [progress, setProgress] = useState(0);
  const [displayMessage, setDisplayMessage] = useState('Starting analysis...');
  const [estimatedTime, setEstimatedTime] = useState('');

  useEffect(() => {
    if (!stage) {
      setProgress(0);
      return;
    }

    const config = STAGE_CONFIG[stage];
    const targetProgress = config.progress;
    const message = config.message;
    
    setDisplayMessage(message);
    
    // Calculate estimated remaining time
    let totalRemaining = 0;
    const currentStageIndex = Object.keys(STAGE_CONFIG).indexOf(stage);
    
    Object.values(STAGE_CONFIG).forEach((value, index) => {
      if (index >= currentStageIndex) {
        totalRemaining += value.duration;
      }
    });
    
    const minutes = Math.floor(totalRemaining / 60000);
    const seconds = Math.ceil((totalRemaining % 60000) / 1000);
    
    if (minutes > 0) {
      setEstimatedTime(`≈ ${minutes}m ${seconds}s remaining`);
    } else {
      setEstimatedTime(`≈ ${seconds}s remaining`);
    }

    // Smoothly animate progress to target
    const startProgress = progress;
    const progressDiff = targetProgress - startProgress;
    const steps = 20; // Number of animation steps
    const stepDuration = 150; // ms per step
    
    let currentStep = 0;
    const interval = setInterval(() => {
      currentStep++;
      const newProgress = startProgress + (progressDiff * (currentStep / steps));
      setProgress(Math.min(newProgress, targetProgress));
      
      if (currentStep >= steps) {
        clearInterval(interval);
      }
    }, stepDuration);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  // Complete the progress bar when done
  useEffect(() => {
    if (progress >= 95 && progress < 100) {
      const timer = setTimeout(() => {
        setProgress(100);
        setDisplayMessage('Analysis complete!');
        setEstimatedTime('');
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [progress]);

  if (!stage) return null;

  return (
    <div className="w-full max-w-2xl mx-auto mt-6 space-y-3">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center space-x-2">
          <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
          <span className="font-medium text-gray-700">{displayMessage}</span>
        </div>
        {estimatedTime && (
          <span className="text-gray-500 text-xs">{estimatedTime}</span>
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
