import React from 'react';
import DescriptionIcon from '@mui/icons-material/Description';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import TableChartIcon from '@mui/icons-material/TableChart';
import SlideshowIcon from '@mui/icons-material/Slideshow';
import TextSnippetIcon from '@mui/icons-material/TextSnippet';

export class FileIconUtils {
  static getFileIcon(fileName: string, mimeType?: string): React.ReactElement {
    const fileExtension = fileName.split('.').pop()?.toLowerCase();
    
    // Check by MIME type first, then fall back to extension
    if (mimeType) {
      if (mimeType === 'application/pdf') {
        return <PictureAsPdfIcon sx={{ color: '#d32f2f', fontSize: 'inherit' }} />;
      }
      if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) {
        return <TableChartIcon sx={{ color: '#2e7d32', fontSize: 'inherit' }} />;
      }
      if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) {
        return <SlideshowIcon sx={{ color: '#ed6c02', fontSize: 'inherit' }} />;
      }
      if (mimeType.includes('word') || mimeType.includes('document')) {
        return <DescriptionIcon sx={{ color: '#1976d2', fontSize: 'inherit' }} />;
      }
      if (mimeType === 'text/plain') {
        return <TextSnippetIcon sx={{ color: '#757575', fontSize: 'inherit' }} />;
      }
    }
    
    // Fall back to extension-based detection
    switch (fileExtension) {
      case 'pdf':
        return <PictureAsPdfIcon sx={{ color: '#d32f2f', fontSize: 'inherit' }} />;
      case 'doc':
      case 'docx':
        return <DescriptionIcon sx={{ color: '#1976d2', fontSize: 'inherit' }} />;
      case 'xls':
      case 'xlsx':
      case 'csv':
        return <TableChartIcon sx={{ color: '#2e7d32', fontSize: 'inherit' }} />;
      case 'ppt':
      case 'pptx':
        return <SlideshowIcon sx={{ color: '#ed6c02', fontSize: 'inherit' }} />;
      case 'txt':
        return <TextSnippetIcon sx={{ color: '#757575', fontSize: 'inherit' }} />;
      default:
        return <DescriptionIcon sx={{ color: '#1976d2', fontSize: 'inherit' }} />;
    }
  }
  
  static getFileTypeColor(fileName: string, mimeType?: string): string {
    const fileExtension = fileName.split('.').pop()?.toLowerCase();
    
    if (mimeType) {
      if (mimeType === 'application/pdf') return '#d32f2f';
      if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return '#2e7d32';
      if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return '#ed6c02';
      if (mimeType.includes('word') || mimeType.includes('document')) return '#1976d2';
      if (mimeType === 'text/plain') return '#757575';
    }
    
    switch (fileExtension) {
      case 'pdf': return '#d32f2f';
      case 'doc':
      case 'docx': return '#1976d2';
      case 'xls':
      case 'xlsx':
      case 'csv': return '#2e7d32';
      case 'ppt':
      case 'pptx': return '#ed6c02';
      case 'txt': return '#757575';
      default: return '#1976d2';
    }
  }
}
