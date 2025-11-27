import { Search } from 'lucide-react';
import type { AnalysisData } from '../types';

interface CategorySidebarProps {
  data: AnalysisData;
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  polity: 'Polity',
  economy: 'Economy',
  international_relations: 'International Relations',
  science_tech: 'Science & Technology',
  environment: 'Environment',
  geography: 'Geography',
  culture: 'Culture',
  security: 'Security',
  misc: 'Miscellaneous',
};

const CATEGORY_COLORS: Record<string, string> = {
  polity: 'bg-blue-100 text-blue-800',
  economy: 'bg-green-100 text-green-800',
  international_relations: 'bg-purple-100 text-purple-800',
  science_tech: 'bg-cyan-100 text-cyan-800',
  environment: 'bg-emerald-100 text-emerald-800',
  geography: 'bg-amber-100 text-amber-800',
  culture: 'bg-pink-100 text-pink-800',
  security: 'bg-red-100 text-red-800',
  misc: 'bg-gray-100 text-gray-800',
};

export default function CategorySidebar({
  data,
  selectedCategory,
  onSelectCategory,
  searchQuery,
  onSearchChange,
}: CategorySidebarProps) {
  const categories = Object.keys(data.categories);
  const totalItems = categories.reduce(
    (sum, cat) => sum + data.categories[cat as keyof typeof data.categories].length,
    0
  );

  return (
    <div className="w-full lg:w-80 bg-white border-r border-gray-200 flex flex-col">
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Categories</h2>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by title..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <button
          onClick={() => onSelectCategory('all')}
          className={`w-full text-left px-6 py-3 border-b border-gray-100 transition-colors ${
            selectedCategory === 'all'
              ? 'bg-blue-50 border-l-4 border-l-blue-600'
              : 'hover:bg-gray-50'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="font-medium text-gray-900">All Categories</span>
            <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
              {totalItems}
            </span>
          </div>
        </button>

        {categories.map((category) => {
          const count = data.categories[category as keyof typeof data.categories].length;
          const label = CATEGORY_LABELS[category] || category;
          const colorClass = CATEGORY_COLORS[category] || 'bg-gray-100 text-gray-800';

          return (
            <button
              key={category}
              onClick={() => onSelectCategory(category)}
              className={`w-full text-left px-6 py-3 border-b border-gray-100 transition-colors ${
                selectedCategory === category
                  ? 'bg-blue-50 border-l-4 border-l-blue-600'
                  : 'hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-gray-900 text-sm">{label}</span>
                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${colorClass}`}>
                  {count}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
