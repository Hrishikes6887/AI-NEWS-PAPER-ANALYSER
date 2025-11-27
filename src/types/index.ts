export interface UploadedFile {
  file: File;
  name: string;
  size: number;
  type: string;
}

export interface FileUploadProps {
  onFileSelect: (file: File) => void;
  isLoading?: boolean;
  error?: string | null;
}

export interface NewsItem {
  title: string;
  points: string[];
  references: {
    page: number;
    excerpt: string;
  }[];
  confidence: number;
}

export interface AnalysisData {
  source_file: string;
  categories: {
    polity: NewsItem[];
    economy: NewsItem[];
    international_relations: NewsItem[];
    science_tech: NewsItem[];
    environment: NewsItem[];
    geography: NewsItem[];
    culture: NewsItem[];
    security: NewsItem[];
    misc: NewsItem[];
  };
}
