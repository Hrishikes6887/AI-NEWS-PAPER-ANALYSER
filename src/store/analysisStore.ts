import { create } from 'zustand';
import type { AnalysisData, NewsItem } from '../types';

interface AnalysisState {
  analysisJSON: AnalysisData | null;
  editedJSON: AnalysisData | null;
  aiRawResponse: string | null;
  isLoading: boolean;
  error: string | null;
  bookmarkedItems: Set<string>;

  setAnalysis: (data: AnalysisData, rawResponse: string) => void;
  updatePoint: (category: string, itemIndex: number, pointIndex: number, newText: string) => void;
  updateTitle: (category: string, itemIndex: number, newTitle: string) => void;
  revertPoint: (category: string, itemIndex: number, pointIndex: number) => void;
  saveEdits: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  toggleBookmark: (itemId: string) => void;
  reset: () => void;
}

const generateItemId = (category: string, itemIndex: number): string => {
  return `${category}-${itemIndex}`;
};

export const useAnalysisStore = create<AnalysisState>((set, get) => ({
  analysisJSON: null,
  editedJSON: null,
  aiRawResponse: null,
  isLoading: false,
  error: null,
  bookmarkedItems: new Set(),

  setAnalysis: (data, rawResponse) => {
    set({
      analysisJSON: data,
      editedJSON: JSON.parse(JSON.stringify(data)),
      aiRawResponse: rawResponse,
      error: null,
    });
  },

  updatePoint: (category, itemIndex, pointIndex, newText) => {
    const { editedJSON } = get();
    if (!editedJSON) return;

    const updatedJSON = JSON.parse(JSON.stringify(editedJSON)) as AnalysisData;
    const categoryKey = category as keyof typeof updatedJSON.categories;

    if (updatedJSON.categories[categoryKey]?.[itemIndex]?.points?.[pointIndex] !== undefined) {
      updatedJSON.categories[categoryKey][itemIndex].points[pointIndex] = newText;
      set({ editedJSON: updatedJSON });
    }
  },

  updateTitle: (category, itemIndex, newTitle) => {
    const { editedJSON } = get();
    if (!editedJSON) return;

    const updatedJSON = JSON.parse(JSON.stringify(editedJSON)) as AnalysisData;
    const categoryKey = category as keyof typeof updatedJSON.categories;

    if (updatedJSON.categories[categoryKey]?.[itemIndex]) {
      updatedJSON.categories[categoryKey][itemIndex].title = newTitle;
      set({ editedJSON: updatedJSON });
    }
  },

  revertPoint: (category, itemIndex, pointIndex) => {
    const { analysisJSON, editedJSON } = get();
    if (!analysisJSON || !editedJSON) return;

    const updatedJSON = JSON.parse(JSON.stringify(editedJSON)) as AnalysisData;
    const categoryKey = category as keyof typeof updatedJSON.categories;

    const originalPoint = analysisJSON.categories[categoryKey]?.[itemIndex]?.points?.[pointIndex];
    if (originalPoint && updatedJSON.categories[categoryKey]?.[itemIndex]?.points?.[pointIndex] !== undefined) {
      updatedJSON.categories[categoryKey][itemIndex].points[pointIndex] = originalPoint;
      set({ editedJSON: updatedJSON });
    }
  },

  saveEdits: () => {
    const { editedJSON } = get();
    if (editedJSON) {
      localStorage.setItem('upsc-analysis-edits', JSON.stringify(editedJSON));
    }
  },

  setLoading: (loading) => set({ isLoading: loading }),

  setError: (error) => set({ error }),

  toggleBookmark: (itemId) => {
    const { bookmarkedItems } = get();
    const newBookmarks = new Set(bookmarkedItems);
    if (newBookmarks.has(itemId)) {
      newBookmarks.delete(itemId);
    } else {
      newBookmarks.add(itemId);
    }
    set({ bookmarkedItems: newBookmarks });
  },

  reset: () => set({
    analysisJSON: null,
    editedJSON: null,
    aiRawResponse: null,
    isLoading: false,
    error: null,
    bookmarkedItems: new Set(),
  }),
}));
