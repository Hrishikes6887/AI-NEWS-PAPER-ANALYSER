import { useState } from 'react';
import TextareaAutosize from 'react-textarea-autosize';
import {
  ChevronDown,
  ChevronUp,
  Copy,
  Edit2,
  Save,
  Bookmark,
  Download,
  Undo,
  RotateCcw,
  FileText,
  Check,
} from 'lucide-react';
import { useAnalysisStore } from '../store/analysisStore';
import { formatForClipboard, copyToClipboard, buildPDF, buildDOCX, downloadFile } from '../lib/exportUtils';
import type { NewsItem } from '../types';

interface NewsItemCardProps {
  item: NewsItem;
  category: string;
  itemIndex: number;
  isBookmarked: boolean;
}

export default function NewsItemCard({ item, category, itemIndex, isBookmarked }: NewsItemCardProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editingPointIndex, setEditingPointIndex] = useState<number | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [showCopied, setShowCopied] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [exportingFormat, setExportingFormat] = useState<string | null>(null);

  const { updatePoint, updateTitle, revertPoint, toggleBookmark } = useAnalysisStore();

  const itemId = `${category}-${itemIndex}`;
  const avgConfidence = item.confidence || 0;

  const handleCopyPoint = async (point: string) => {
    const success = await copyToClipboard(point);
    if (success) {
      setShowCopied(true);
      setTimeout(() => setShowCopied(false), 2000);
    }
  };

  const handleCopyAll = async () => {
    const text = formatForClipboard(item);
    const success = await copyToClipboard(text);
    if (success) {
      setShowCopied(true);
      setTimeout(() => setShowCopied(false), 2000);
    }
  };

  const handleExport = async (format: 'pdf' | 'docx' | 'json') => {
    setExportingFormat(format);
    try {
      if (format === 'pdf') {
        const blob = await buildPDF([item], category, item.title);
        downloadFile(`${item.title.substring(0, 30)}.pdf`, blob);
      } else if (format === 'docx') {
        const blob = await buildDOCX([item], category);
        downloadFile(`${item.title.substring(0, 30)}.docx`, blob);
      } else if (format === 'json') {
        const json = JSON.stringify(item, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        downloadFile(`${item.title.substring(0, 30)}.json`, blob);
      }
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setExportingFormat(null);
      setShowExportMenu(false);
    }
  };

  const handleJumpToPDF = (pageNumber: number) => {
    console.log(`Jump to PDF page: ${pageNumber}`);
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1 mr-4">
            {editingTitle ? (
              <TextareaAutosize
                value={item.title}
                onChange={(e) => updateTitle(category, itemIndex, e.target.value)}
                onBlur={() => setEditingTitle(false)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    setEditingTitle(false);
                  }
                  if (e.key === 'Escape') {
                    setEditingTitle(false);
                  }
                }}
                className="w-full text-xl font-semibold text-gray-900 border-2 border-blue-500 rounded px-2 py-1 focus:outline-none resize-none"
                autoFocus
              />
            ) : (
              <h3
                className="text-xl font-semibold text-gray-900 cursor-pointer hover:text-blue-600"
                onClick={() => setEditingTitle(true)}
              >
                {item.title}
              </h3>
            )}

            <div className="flex items-center gap-2 mt-2">
              <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                {category.replace(/_/g, ' ')}
              </span>
              <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                Confidence: {(avgConfidence * 100).toFixed(0)}%
              </span>
            </div>
          </div>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? (
              <ChevronUp className="w-5 h-5 text-gray-600" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-600" />
            )}
          </button>
        </div>

        {isExpanded && (
          <>
            <div className="space-y-4 mb-6">
              {item.points.map((point, pointIndex) => (
                <div key={pointIndex} className="relative group">
                  <div className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center text-sm font-semibold text-blue-600 bg-blue-50 rounded-full mt-1">
                      {pointIndex + 1}
                    </span>

                    <div className="flex-1">
                      {editingPointIndex === pointIndex ? (
                        <TextareaAutosize
                          value={point}
                          onChange={(e) => updatePoint(category, itemIndex, pointIndex, e.target.value)}
                          onBlur={() => setEditingPointIndex(null)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && e.ctrlKey) {
                              setEditingPointIndex(null);
                            }
                            if (e.key === 'Escape') {
                              setEditingPointIndex(null);
                            }
                          }}
                          className="w-full text-gray-700 border-2 border-blue-500 rounded px-3 py-2 focus:outline-none resize-none"
                          autoFocus
                        />
                      ) : (
                        <p className="text-gray-700 leading-relaxed">{point}</p>
                      )}
                    </div>

                    <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                      <button
                        onClick={() => setEditingPointIndex(pointIndex)}
                        className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                        aria-label="Edit point"
                      >
                        <Edit2 className="w-4 h-4 text-gray-500" />
                      </button>
                      <button
                        onClick={() => handleCopyPoint(point)}
                        className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                        aria-label="Copy point"
                      >
                        <Copy className="w-4 h-4 text-gray-500" />
                      </button>
                      <button
                        onClick={() => revertPoint(category, itemIndex, pointIndex)}
                        className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                        aria-label="Revert to AI"
                        title="Revert to AI"
                      >
                        <RotateCcw className="w-4 h-4 text-gray-500" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {item.references && item.references.length > 0 && (
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">References</h4>
                <div className="space-y-2">
                  {item.references.map((ref, refIndex) => (
                    <button
                      key={refIndex}
                      onClick={() => handleJumpToPDF(ref.page)}
                      className="block w-full text-left text-sm text-gray-600 hover:text-blue-600 hover:bg-white px-3 py-2 rounded transition-colors"
                    >
                      <span className="font-medium">Page {ref.page}:</span>{' '}
                      <span className="italic">&quot;{ref.excerpt}&quot;</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-4 border-t border-gray-200">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyAll}
                  className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Copy All
                </button>

                <button
                  onClick={() => setIsEditing(!isEditing)}
                  className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  {isEditing ? (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Done
                    </>
                  ) : (
                    <>
                      <Edit2 className="w-4 h-4 mr-2" />
                      Edit
                    </>
                  )}
                </button>

                <button
                  onClick={() => toggleBookmark(itemId)}
                  className={`inline-flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    isBookmarked
                      ? 'text-yellow-700 bg-yellow-50 border border-yellow-300'
                      : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <Bookmark className={`w-4 h-4 mr-2 ${isBookmarked ? 'fill-yellow-500' : ''}`} />
                  {isBookmarked ? 'Bookmarked' : 'Bookmark'}
                </button>
              </div>

              <div className="relative">
                <button
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  className="inline-flex items-center px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </button>

                {showExportMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10">
                    <button
                      onClick={() => handleExport('json')}
                      disabled={exportingFormat === 'json'}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                    >
                      <FileText className="w-4 h-4 inline mr-2" />
                      Export as JSON
                    </button>
                    <button
                      onClick={() => handleExport('docx')}
                      disabled={exportingFormat === 'docx'}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                    >
                      <FileText className="w-4 h-4 inline mr-2" />
                      Export as DOCX
                    </button>
                    <button
                      onClick={() => handleExport('pdf')}
                      disabled={exportingFormat === 'pdf'}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                    >
                      <FileText className="w-4 h-4 inline mr-2" />
                      Export as PDF
                    </button>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {showCopied && (
        <div className="fixed bottom-4 right-4 px-4 py-2 bg-green-600 text-white rounded-lg shadow-lg flex items-center gap-2 animate-fade-in">
          <Check className="w-4 h-4" />
          Copied to clipboard!
        </div>
      )}
    </div>
  );
}
