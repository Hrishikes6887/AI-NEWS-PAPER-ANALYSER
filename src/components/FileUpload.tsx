import { useState, useRef } from 'react';
import { Upload, File, AlertCircle, X } from 'lucide-react';
import pdfParse from 'pdf-parse';
import type { FileUploadProps } from '../types';

// ⚠️ STRICT PRODUCTION LIMITS - Hard enforced for stability
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB hard limit - no exceptions
const MAX_PAGES = 12; // Maximum 12 pages - strictly enforced
const ALLOWED_TYPES = ['.pdf', '.docx'];

export default function FileUpload({ onFileSelect, isLoading = false, error }: FileUploadProps) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const displayError = error || localError;

  const validateFile = async (file: File): Promise<string | null> => {
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();

    if (!ALLOWED_TYPES.includes(fileExtension)) {
      return `Invalid file type. Please upload ${ALLOWED_TYPES.join(' or ')} files only.`;
    }

    // ⚠️ STRICT FILE SIZE CHECK - Block immediately if too large
    if (file.size > MAX_FILE_SIZE) {
      return `File too large. Please upload newspapers up to ${MAX_FILE_SIZE / (1024 * 1024)} MB. Your file is ${(file.size / (1024 * 1024)).toFixed(1)} MB.`;
    }

    // Validate page count for PDFs
    if (fileExtension === '.pdf') {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const pdfData = await pdfParse(Buffer.from(arrayBuffer));
        
        // ⚠️ STRICT PAGE LIMIT CHECK - Block if exceeded
        if (pdfData.numpages > MAX_PAGES) {
          return `This newspaper has ${pdfData.numpages} pages. Maximum allowed is ${MAX_PAGES} pages. Please upload the first ${MAX_PAGES} pages for best results.`;
        }
      } catch (err) {
        console.error('Error parsing PDF for page count:', err);
        // Continue if page count validation fails - backend will catch it
      }
    }

    return null;
  };

  const handleFile = async (file: File) => {
    setLocalError(null);

    const validationError = await validateFile(file);
    if (validationError) {
      setLocalError(validationError);
      return;
    }

    setSelectedFile(file);
    onFileSelect(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  const clearFile = () => {
    setSelectedFile(null);
    setLocalError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-xl transition-all duration-200 ${
          dragActive
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 bg-white hover:border-gray-400'
        } ${isLoading ? 'opacity-50 pointer-events-none' : ''}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept={ALLOWED_TYPES.join(',')}
          onChange={handleChange}
          disabled={isLoading}
        />

        <div className="p-12">
          {!selectedFile ? (
            <div className="flex flex-col items-center justify-center text-center space-y-4">
              <div className="p-4 bg-blue-50 rounded-full">
                <Upload className="w-12 h-12 text-blue-600" />
              </div>

              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Drop your file here
                </h3>
                <p className="text-gray-600 mb-4">
                  or click to browse from your device
                </p>
                <p className="text-sm text-gray-500">
                  Supports PDF and DOCX files up to 10MB or 12 pages
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  ⚠️ Files exceeding these limits will be rejected
                </p>
              </div>

              <button
                onClick={handleButtonClick}
                disabled={isLoading}
                className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Choose File
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between bg-gray-50 p-4 rounded-lg">
              <div className="flex items-center space-x-3 flex-1 min-w-0">
                <div className="p-2 bg-blue-100 rounded">
                  <File className="w-6 h-6 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {selectedFile.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                  </p>
                </div>
              </div>

              {!isLoading && (
                <button
                  onClick={clearFile}
                  className="p-2 hover:bg-gray-200 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              )}
            </div>
          )}

          {isLoading && (
            <div className="mt-4 flex items-center justify-center space-x-2">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
              <span className="text-sm text-gray-600">Processing...</span>
            </div>
          )}
        </div>
      </div>

      {/* Error messages (red) */}
      {displayError && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-800">{displayError}</p>
        </div>
      )}
    </div>
  );
}
