export interface AnalysisResponse {
  success: boolean;
  data?: any;
  error?: string;
}

export async function analyzeDocument(file: File): Promise<AnalysisResponse> {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('fileName', file.name);

    const response = await fetch('/api/analyze', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `API error: ${response.status} - ${errorText}`,
      };
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error analyzing document:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}
