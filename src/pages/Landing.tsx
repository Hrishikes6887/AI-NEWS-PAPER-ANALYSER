import { useState, useEffect } from 'react';
import { Sparkles, Brain, FileCheck, ArrowRight, Clock } from 'lucide-react';
import FileUpload from '../components/FileUpload';
import { useAnalysisStore } from '../store/analysisStore';
import type { UploadedFile } from '../types';

interface LandingProps {
  onNavigateToAnalysis: () => void;
}

export default function Landing({ onNavigateToAnalysis }: LandingProps) {
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  const { setAnalysis, setLoading: setStoreLoading, setError: setStoreError } = useAnalysisStore();

  // Cooldown timer
  useEffect(() => {
    if (cooldownSeconds > 0) {
      const timer = setTimeout(() => setCooldownSeconds(cooldownSeconds - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldownSeconds]);

  const handleFileSelect = (file: File) => {
    setUploadedFile({
      file,
      name: file.name,
      size: file.size,
      type: file.type,
    });
    setError(null);
  };

  const handleProceed = async () => {
    if (!uploadedFile) {
      setError('Please select a file first');
      return;
    }

    setIsLoading(true);
    setStoreLoading(true);
    setError(null);
    setStoreError(null);

    try {
      console.log('Starting analysis for file:', uploadedFile.name);
      console.log('File size:', (uploadedFile.size / (1024 * 1024)).toFixed(2), 'MB');

      const formData = new FormData();
      formData.append('file', uploadedFile.file);
      formData.append('fileName', uploadedFile.name);

      console.log('Calling local API:', '/api/analyze');

      const response = await fetch('/api/analyze', {
        method: 'POST',
        body: formData,
      });

      console.log('Response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error('Response error:', errorData);
        
        // Handle cooldown/rate limit errors with retry timer
        if (response.status === 429 && errorData?.retryAfter) {
          setCooldownSeconds(errorData.retryAfter);
          throw new Error(errorData.error || 'Please wait before uploading another document');
        }
        
        throw new Error(errorData?.error || `Analysis failed (${response.status})`);
      }

      const result = await response.json();
      console.log('Analysis result:', result);

      if (result.success && result.data) {
        setAnalysis(result.data, JSON.stringify(result.data, null, 2));
        console.log('Analysis stored successfully');
        
        // Start 5-second cooldown for next upload
        setCooldownSeconds(5);

        onNavigateToAnalysis();
      } else {
        throw new Error(result.error || 'Analysis failed');
      }
    } catch (err) {
      console.error('Analysis error:', err);
      const errorMsg = err instanceof Error ? err.message : 'Failed to analyze document';
      setError(errorMsg);
      setStoreError(errorMsg);
    } finally {
      setIsLoading(false);
      setStoreLoading(false);
    }
  };

  return (
    <div className="min-h-screen">
      <section className="pt-16 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl font-bold text-gray-900 mb-6 leading-tight">
            Analyze Current Affairs Documents
            <br />
            <span className="text-blue-600">For UPSC Preparation</span>
          </h1>

          <p className="text-xl text-gray-600 mb-12 max-w-2xl mx-auto">
            Upload your current affairs PDFs or documents and get instant AI-powered analysis,
            key insights, and structured notes tailored for UPSC exam preparation.
          </p>

          <div className="mb-16">
            <FileUpload
              onFileSelect={handleFileSelect}
              isLoading={isLoading}
              error={error}
            />

            {uploadedFile && !isLoading && !error && (
              <div className="mt-8 flex flex-col items-center space-y-4">
                <button
                  onClick={handleProceed}
                  disabled={cooldownSeconds > 0}
                  className="inline-flex items-center px-8 py-4 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-lg hover:shadow-xl space-x-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-blue-600"
                >
                  <span>Analyze Document</span>
                  <ArrowRight className="w-5 h-5" />
                </button>
                
                {cooldownSeconds > 0 && (
                  <div className="flex items-center space-x-2 text-amber-600 bg-amber-50 px-4 py-2 rounded-lg">
                    <Clock className="w-4 h-4" />
                    <span className="text-sm font-medium">
                      Wait {cooldownSeconds}s before next upload (prevents rate limit)
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">
            Powerful Features for UPSC Aspirants
          </h2>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="p-6 rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-lg transition-all">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <Brain className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">
                AI-Powered Analysis
              </h3>
              <p className="text-gray-600">
                Extract key themes, important facts, and exam-relevant insights from your documents automatically.
              </p>
            </div>

            <div className="p-6 rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-lg transition-all">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                <FileCheck className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">
                Structured Notes
              </h3>
              <p className="text-gray-600">
                Get organized, topic-wise summaries formatted specifically for effective revision and memorization.
              </p>
            </div>

            <div className="p-6 rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-lg transition-all">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                <Sparkles className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">
                Smart Highlights
              </h3>
              <p className="text-gray-600">
                Automatically identify and highlight critical information, dates, statistics, and important personalities.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
