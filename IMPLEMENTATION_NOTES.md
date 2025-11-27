# UPSC Current Affairs Analyzer - Implementation Notes

## Features Implemented

### 1. Global State Management (Zustand)
- **Location**: `src/store/analysisStore.ts`
- Stores analysis JSON, edited JSON, and AI raw response
- Actions: setAnalysis, updatePoint, updateTitle, revertPoint, saveEdits, toggleBookmark
- Bookmarking system for favorite items

### 2. Analysis Page
- **Location**: `src/pages/Analysis.tsx`
- Auto-triggers analysis on mount using the Supabase Edge Function
- Default file path: `I:\NEW DOWNLOADS\kalpas task\output_images\the-hindu-2025-11-18.pdf`
- Loading states with spinner and "Analyzing newspaper..." message
- Error handling with retry functionality
- Top controls: Copy All, Save Edits, Export dropdown

### 3. Category Sidebar
- **Location**: `src/components/CategorySidebar.tsx`
- Lists all 9 UPSC categories with item counts
- Search functionality to filter by title
- Color-coded category badges
- "All Categories" view
- Responsive design (collapses on mobile)

### 4. News Item Card
- **Location**: `src/components/NewsItemCard.tsx`
- Expandable/collapsible cards
- **Title editing**: Click title to edit inline
- **Point editing**: Hover over point to show edit/copy/revert buttons
- Inline textarea with auto-resize
- Keyboard shortcuts: Enter to save, Esc to cancel
- Confidence score display
- Reference section with page numbers and excerpts
- Footer actions:
  - Copy All (copies formatted text)
  - Edit toggle
  - Bookmark
  - Download dropdown (JSON, DOCX, PDF)

### 5. Copy to Clipboard
- **Location**: `src/lib/exportUtils.ts`
- Formats items as structured text:
  ```
  Title: <title>
  1. <point>
  2. <point>
  References: Page X — "excerpt"
  ```
- Copy individual points, entire cards, or all items
- Success toast notification

### 6. Export Functionality
- **PDF Export**: Uses jsPDF to create formatted PDFs
- **DOCX Export**: Uses docx library for Word documents
- **JSON Export**: Downloads edited JSON
- **PPT JSON Export**: Special format for PowerPoint integration
- Progress indicator during export

### 7. Inline Editing Features
- **Update Point**: Edit any point with instant state update
- **Update Title**: Click title to edit
- **Revert to AI**: Reset edited point to original AI-generated text
- **Save Edits**: Persists to localStorage
- Optimistic updates (UI updates immediately)

### 8. Keyboard Accessibility
- Enter to save edits
- Escape to cancel edits
- Tab navigation support
- Focus indicators on all interactive elements
- ARIA labels for screen readers

### 9. Responsive Design
- Mobile-friendly sidebar (collapses to top)
- Card grid adjusts to screen size
- Touch-friendly buttons and controls
- Max-width containers for readability

## File Structure

```
src/
├── components/
│   ├── CategorySidebar.tsx    # Left sidebar with categories
│   ├── FileUpload.tsx          # File upload component (landing page)
│   ├── Layout.tsx              # Main layout wrapper
│   ├── Navbar.tsx              # Top navigation
│   └── NewsItemCard.tsx        # Individual news item card
├── lib/
│   ├── api.ts                  # API client for Supabase Edge Function
│   ├── exportUtils.ts          # Export/clipboard utilities
│   └── prompts.ts              # AI prompt builder
├── pages/
│   ├── Analysis.tsx            # Main analysis page
│   └── Landing.tsx             # Landing/upload page
├── store/
│   └── analysisStore.ts        # Zustand global state
├── types/
│   └── index.ts                # TypeScript interfaces
└── App.tsx                     # Root component with routing
```

## Data Flow

1. **Landing Page**: User clicks "Proceed to Analysis"
2. **Analysis Page**: Automatically calls Supabase Edge Function `/functions/v1/analyze-document`
3. **Edge Function**:
   - Extracts text from PDF/DOCX
   - Builds UPSC-specific prompt
   - Calls Gemini API
   - Returns structured JSON
4. **Store**: Analysis data stored in Zustand
5. **UI**: Renders categories and news items
6. **Editing**: User edits → updates editedJSON in store
7. **Export**: User exports → formats data → downloads file

## Key Technologies

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Zustand** - State management
- **jsPDF** - PDF generation
- **docx** - Word document generation
- **react-textarea-autosize** - Auto-resizing textareas
- **Supabase** - Edge Functions for backend
- **Gemini API** - AI analysis

## Usage Notes

### Default File Path
The analysis page uses this default path for testing:
```
I:\NEW DOWNLOADS\kalpas task\output_images\the-hindu-2025-11-18.pdf
```

This path is defined in `src/pages/Analysis.tsx` as `DEFAULT_FILE_PATH`.

### Local Storage
Edited data is saved to localStorage with key: `upsc-analysis-edits`

### Keyboard Shortcuts
- **Edit Title/Point**: Click to edit
- **Save**: Enter (or Ctrl+Enter for multiline)
- **Cancel**: Escape
- **Copy Point**: Click copy icon
- **Revert**: Click revert icon

### Export Formats
1. **PDF**: Formatted document with title, bullets, references
2. **DOCX**: Word document with proper heading levels
3. **JSON**: Raw analysis data (edited version)
4. **PPT JSON**: Special format for slide generation

## Future Enhancements

- Database persistence (replace localStorage)
- PDF viewer with page jump functionality
- Undo/redo stack for edits
- Collaborative editing
- Analytics dashboard
- Custom category creation
- Batch document processing
