import { jsPDF } from 'jspdf';
import { Document, Paragraph, TextRun, HeadingLevel, AlignmentType, Packer } from 'docx';
import type { NewsItem, AnalysisData } from '../types';

export function formatForClipboard(item: NewsItem): string {
  let text = `Title: ${item.title}\n\n`;

  item.points.forEach((point, index) => {
    text += `${index + 1}. ${point}\n`;
  });

  if (item.references && item.references.length > 0) {
    text += `\nReferences:\n`;
    item.references.forEach(ref => {
      text += `  Page ${ref.page} — "${ref.excerpt}"\n`;
    });
  }

  return text;
}

export function formatAllForClipboard(items: NewsItem[], category?: string): string {
  let text = '';

  if (category) {
    text += `${category.toUpperCase().replace(/_/g, ' ')}\n\n`;
  }

  items.forEach((item, idx) => {
    text += formatForClipboard(item);
    if (idx < items.length - 1) {
      text += '\n---\n\n';
    }
  });

  return text;
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
}

export function downloadFile(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadJSON(data: AnalysisData, filename: string): void {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  downloadFile(filename, blob);
}

export async function buildPDF(items: NewsItem[], category: string, fileName: string): Promise<Blob> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const maxWidth = pageWidth - (margin * 2);
  let yPosition = 20;

  doc.setFontSize(18);
  doc.text(category.toUpperCase().replace(/_/g, ' '), margin, yPosition);
  yPosition += 15;

  items.forEach((item, itemIndex) => {
    if (yPosition > 250) {
      doc.addPage();
      yPosition = 20;
    }

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    const titleLines = doc.splitTextToSize(item.title, maxWidth);
    doc.text(titleLines, margin, yPosition);
    yPosition += (titleLines.length * 7) + 5;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');

    item.points.forEach((point, pointIndex) => {
      if (yPosition > 260) {
        doc.addPage();
        yPosition = 20;
      }

      const bullet = `${pointIndex + 1}. `;
      const pointLines = doc.splitTextToSize(point, maxWidth - 10);

      doc.text(bullet, margin + 5, yPosition);
      doc.text(pointLines, margin + 15, yPosition);
      yPosition += (pointLines.length * 5) + 3;
    });

    if (item.references && item.references.length > 0) {
      if (yPosition > 260) {
        doc.addPage();
        yPosition = 20;
      }

      doc.setFontSize(8);
      doc.setFont('helvetica', 'italic');
      doc.text('References:', margin + 5, yPosition);
      yPosition += 5;

      item.references.forEach(ref => {
        if (yPosition > 270) {
          doc.addPage();
          yPosition = 20;
        }
        const refText = `Page ${ref.page}: ${ref.excerpt.substring(0, 100)}...`;
        const refLines = doc.splitTextToSize(refText, maxWidth - 10);
        doc.text(refLines, margin + 10, yPosition);
        yPosition += (refLines.length * 4) + 2;
      });
    }

    yPosition += 10;
  });

  return doc.output('blob');
}

export async function buildDOCX(items: NewsItem[], category: string): Promise<Blob> {
  const children: any[] = [];

  children.push(
    new Paragraph({
      text: category.toUpperCase().replace(/_/g, ' '),
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 200 },
    })
  );

  items.forEach((item) => {
    children.push(
      new Paragraph({
        text: item.title,
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 200, after: 100 },
      })
    );

    item.points.forEach((point, index) => {
      children.push(
        new Paragraph({
          text: `${index + 1}. ${point}`,
          spacing: { after: 100 },
          indent: { left: 360 },
        })
      );
    });

    if (item.references && item.references.length > 0) {
      children.push(
        new Paragraph({
          text: 'References:',
          italics: true,
          spacing: { before: 100, after: 50 },
        })
      );

      item.references.forEach(ref => {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `Page ${ref.page}: ${ref.excerpt}`,
                italics: true,
                size: 18,
              }),
            ],
            spacing: { after: 50 },
            indent: { left: 720 },
          })
        );
      });
    }
  });

  const doc = new Document({
    sections: [{
      properties: {},
      children,
    }],
  });

  return await Packer.toBlob(doc);
}

export function buildPPTJSON(data: AnalysisData): any {
  const slides: any[] = [];

  Object.entries(data.categories).forEach(([category, items]) => {
    if (items.length === 0) return;

    slides.push({
      title: category.toUpperCase().replace(/_/g, ' '),
      type: 'category-title',
    });

    items.forEach(item => {
      slides.push({
        title: item.title,
        bullets: item.points,
        category,
        confidence: item.confidence,
      });
    });
  });

  return { slides };
}
