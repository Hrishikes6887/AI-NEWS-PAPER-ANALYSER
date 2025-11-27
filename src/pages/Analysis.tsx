import { useState, useMemo } from 'react';
import { Loader2, AlertCircle, Download, Copy, Save, Check, ArrowLeft } from 'lucide-react';
import { useAnalysisStore } from '../store/analysisStore';
import CategorySidebar from '../components/CategorySidebar';
import NewsItemCard from '../components/NewsItemCard';
import {
  formatAllForClipboard,
  copyToClipboard,
  buildPDF,
  buildDOCX,
  downloadFile,
  downloadJSON,
  buildPPTJSON,
} from '../lib/exportUtils';
import type { NewsItem } from '../types';

interface AnalysisProps {
  onNavigateToLanding: () => void;
}

export default function Analysis({ onNavigateToLanding }: AnalysisProps) {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCopied, setShowCopied] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [exportingFormat, setExportingFormat] = useState<string | null>(null);

  const {
    analysisJSON,
    editedJSON,
    isLoading,
    error,
    bookmarkedItems,
    saveEdits,
    reset,
  } = useAnalysisStore();

  const handleBackToUpload = () => {
    reset();
    onNavigateToLanding();
  };

  const filteredItems = useMemo(() => {
    if (!editedJSON) return [];

    let items: Array<{ item: NewsItem; category: string; itemIndex: number }> = [];

    if (selectedCategory === 'all') {
      Object.entries(editedJSON.categories).forEach(([category, categoryItems]) => {
        categoryItems.forEach((item, index) => {
          items.push({ item, category, itemIndex: index });
        });
      });
    } else {
      const categoryKey = selectedCategory as keyof typeof editedJSON.categories;
      const categoryItems = editedJSON.categories[categoryKey] || [];
      items = categoryItems.map((item, index) => ({ item, category: selectedCategory, itemIndex: index }));
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      items = items.filter(({ item }) =>
        item.title.toLowerCase().includes(query)
      );
    }

    return items;
  }, [editedJSON, selectedCategory, searchQuery]);

  const handleRetry = () => {
    setError(null);
    window.location.reload();
  };

  const handleCopyAll = async () => {
    if (!editedJSON) return;

    const items = filteredItems.map(({ item }) => item);
    const text = formatAllForClipboard(items, selectedCategory !== 'all' ? selectedCategory : undefined);
    const success = await copyToClipboard(text);

    if (success) {
      setShowCopied(true);
      setTimeout(() => setShowCopied(false), 2000);
    }
  };

  const handleSaveEdits = () => {
    saveEdits();
    setShowSaved(true);
    setTimeout(() => setShowSaved(false), 2000);
  };

  const handleExport = async (format: 'pdf' | 'docx' | 'json' | 'ppt-json') => {
    if (!editedJSON) return;

    setExportingFormat(format);
    try {
      const items = filteredItems.map(({ item }) => item);
      const categoryLabel = selectedCategory === 'all' ? 'All Categories' : selectedCategory;

      if (format === 'pdf') {
        const blob = await buildPDF(items, categoryLabel, DEFAULT_FILE_NAME);
        downloadFile(`${DEFAULT_FILE_NAME}-analysis.pdf`, blob);
      } else if (format === 'docx') {
        const blob = await buildDOCX(items, categoryLabel);
        downloadFile(`${DEFAULT_FILE_NAME}-analysis.docx`, blob);
      } else if (format === 'json') {
        downloadJSON(editedJSON, `${DEFAULT_FILE_NAME}-analysis.json`);
      } else if (format === 'ppt-json') {
        const pptData = buildPPTJSON(editedJSON);
        const json = JSON.stringify(pptData, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        downloadFile(`${DEFAULT_FILE_NAME}-ppt-data.json`, blob);
      }
    } catch (error) {
      console.error('Export failed:', error);
      setError('Export failed. Please try again.');
    } finally {
      setExportingFormat(null);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Analyzing newspaper...
          </h2>
          <p className="text-gray-600">This may take up to 2 minutes</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <AlertCircle className="w-16 h-16 text-red-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Analysis Failed</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={handleBackToUpload}
            className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
          >
            Upload Another File
          </button>
        </div>
      </div>
    );
  }

  if (!editedJSON) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <CategorySidebar
        data={editedJSON}
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      <div className="flex-1 flex flex-col">
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={handleBackToUpload}
              className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Upload Another File
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {selectedCategory === 'all' ? 'All Categories' : selectedCategory.replace(/_/g, ' ').toUpperCase()}
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                {filteredItems.length} {filteredItems.length === 1 ? 'item' : 'items'} found
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyAll}
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Copy className="w-4 h-4 mr-2" />
                Copy All
              </button>

              <button
                onClick={handleSaveEdits}
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
              >
                <Save className="w-4 h-4 mr-2" />
                Save Edits
              </button>

              <div className="relative group">
                <button className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </button>

                <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                  <button
                    onClick={() => handleExport('pdf')}
                    disabled={exportingFormat === 'pdf'}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                  >
                    Download PDF
                  </button>
                  <button
                    onClick={() => handleExport('docx')}
                    disabled={exportingFormat === 'docx'}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                  >
                    Download DOCX
                  </button>
                  <button
                    onClick={() => handleExport('json')}
                    disabled={exportingFormat === 'json'}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                  >
                    Download JSON
                  </button>
                  <button
                    onClick={() => handleExport('ppt-json')}
                    disabled={exportingFormat === 'ppt-json'}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                  >
                    Export for PPT
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {filteredItems.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">No items found</p>
              {searchQuery && (
                <p className="text-gray-400 text-sm mt-2">Try adjusting your search</p>
              )}
            </div>
          ) : (
            <div className="space-y-6 max-w-5xl mx-auto">
              {filteredItems.map(({ item, category, itemIndex }) => (
                <NewsItemCard
                  key={`${category}-${itemIndex}`}
                  item={item}
                  category={category}
                  itemIndex={itemIndex}
                  isBookmarked={bookmarkedItems.has(`${category}-${itemIndex}`)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {showCopied && (
        <div className="fixed bottom-4 right-4 px-4 py-2 bg-green-600 text-white rounded-lg shadow-lg flex items-center gap-2 z-50">
          <Check className="w-4 h-4" />
          Copied to clipboard!
        </div>
      )}

      {showSaved && (
        <div className="fixed bottom-4 right-4 px-4 py-2 bg-blue-600 text-white rounded-lg shadow-lg flex items-center gap-2 z-50">
          <Check className="w-4 h-4" />
          Edits saved!
        </div>
      )}

      {exportingFormat && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 flex items-center gap-4">
            <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
            <span className="text-gray-900 font-medium">
              Exporting as {exportingFormat.toUpperCase()}...
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
