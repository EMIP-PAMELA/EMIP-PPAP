'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/src/lib/supabaseClient';
import { logEvent } from '@/src/features/events/mutations';
import { getPPAPDocuments } from '@/src/features/ppap/utils/getPPAPDocuments';
import { uploadPPAPDocument } from '@/src/features/ppap/utils/uploadFile';

interface MarkupToolProps {
  ppapId: string;
  partNumber: string;
  onClose: () => void;
}

type InteractionMode = 'navigate' | 'markup' | 'select';
type AnnotationType = 'dimension' | 'note' | 'material' | 'critical';
type AnnotationShape = 'circle' | 'box' | 'triangle' | 'arrow' | 'text';

interface Annotation {
  id: string;
  x: number;
  y: number;
  label_number: number;
  type: AnnotationType;
  shape: AnnotationShape;
  description: string;
}

const TYPE_COLORS: Record<AnnotationType, string> = {
  dimension: 'border-blue-600 bg-blue-500',
  note: 'border-yellow-600 bg-yellow-500',
  material: 'border-green-600 bg-green-500',
  critical: 'border-red-600 bg-red-500',
};

const MODE_INFO: Record<InteractionMode, { label: string; description: string; icon: string }> = {
  navigate: { label: 'Navigate', description: 'Inspect and interact with the drawing', icon: '🔍' },
  markup: { label: 'Markup', description: 'Click anywhere on the drawing to place an annotation', icon: '✏️' },
  select: { label: 'Select', description: 'Click an existing annotation to edit or remove it', icon: '👆' },
};

interface UploadedFile {
  file_name: string;
  file_path: string;
}

export function MarkupTool({ ppapId, partNumber, onClose }: MarkupToolProps) {
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [mode, setMode] = useState<InteractionMode>('navigate');
  const [selectedTool, setSelectedTool] = useState<AnnotationShape>('circle');
  const [selectedType, setSelectedType] = useState<AnnotationType>('dimension');
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDescription, setEditDescription] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isRailCollapsed, setIsRailCollapsed] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [draggingAnnotationId, setDraggingAnnotationId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);
  const descriptionInputRef = useRef<HTMLTextAreaElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Load uploaded files using shared utility
  useEffect(() => {
    const fetchFiles = async () => {
      try {
        const docs = await getPPAPDocuments(ppapId);
        console.log('Documents loaded:', docs);
        setUploadedFiles(docs);
      } catch (error) {
        console.error('Failed to fetch files:', error);
      }
    };

    fetchFiles();
  }, [ppapId]);

  // Auto-select first file when uploadedFiles changes
  useEffect(() => {
    if (uploadedFiles.length > 0 && !selectedFile) {
      setSelectedFile(uploadedFiles[0].file_path);
    }
  }, [uploadedFiles, selectedFile]);

  // Debug logging
  useEffect(() => {
    console.log('uploadedFiles:', uploadedFiles);
    console.log('selectedFile (after auto):', selectedFile);
  }, [uploadedFiles, selectedFile]);

  // Generate signed URL when file is selected
  useEffect(() => {
    if (!selectedFile || typeof selectedFile !== 'string') {
      setFileUrl(null);
      return;
    }

    const loadUrl = async () => {
      const { data, error } = await supabase.storage
        .from('ppap-documents')
        .createSignedUrl(selectedFile, 3600);

      console.log('Signed URL:', data, error);

      if (error) {
        console.error(error);
        setFileUrl(null);
        return;
      }

      setFileUrl(data?.signedUrl || null);
    };

    loadUrl();
  }, [selectedFile]);

  // Load existing annotations for selected file
  useEffect(() => {
    if (!selectedFile) {
      setAnnotations([]);
      return;
    }

    const fetchAnnotations = async () => {
      try {
        const { data, error } = await supabase
          .from('ppap_events')
          .select('event_data')
          .eq('ppap_id', ppapId)
          .eq('event_type', 'DOCUMENT_ADDED')
          .order('created_at', { ascending: false });

        if (error) throw error;

        // Find markup for this specific file
        const markupEvent = data?.find(
          event => event.event_data.markup && event.event_data.file_path === selectedFile
        );
        
        if (markupEvent && markupEvent.event_data.annotations) {
          setAnnotations(markupEvent.event_data.annotations);
        } else {
          setAnnotations([]);
        }
      } catch (error) {
        console.error('Failed to fetch annotations:', error);
      }
    };

    fetchAnnotations();
  }, [ppapId, selectedFile]);

  // Helper for visual marker shorthand (ASCII-safe for PDF export)
  const getMarkerLabel = (shape: AnnotationShape): string => {
    switch (shape) {
      case 'circle': return 'CIRCLE';
      case 'box': return 'BOX';
      case 'triangle': return 'TRIANGLE';
      case 'arrow': return 'ARROW';
      case 'text': return 'TEXT';
      default: return 'CIRCLE';
    }
  };

  const getTypeShorthand = (type: AnnotationType): string => {
    switch (type) {
      case 'dimension': return '[DIM]';
      case 'note': return '[NOTE]';
      case 'material': return '[MAT]';
      case 'critical': return '[CRIT]';
      default: return '';
    }
  };

  const handleAnnotationDragStart = (e: React.MouseEvent, annotationId: string) => {
    e.stopPropagation();
    setDraggingAnnotationId(annotationId);
  };

  const handleAnnotationDrag = (e: React.MouseEvent) => {
    if (!draggingAnnotationId || !containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

    setAnnotations(annotations.map(ann =>
      ann.id === draggingAnnotationId
        ? { ...ann, x, y }
        : ann
    ));
  };

  const handleAnnotationDragEnd = () => {
    setDraggingAnnotationId(null);
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Don't place new annotation if dragging
    if (draggingAnnotationId) return;
    
    // Only allow annotation placement in markup mode
    if (mode !== 'markup') return;
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    console.log('Canvas clicked', { x, y, mode, tool: selectedTool, type: selectedType });

    const newAnnotation: Annotation = {
      id: `annotation-${Date.now()}`,
      x,
      y,
      label_number: annotations.length + 1,
      type: selectedType,
      shape: selectedTool,
      description: '',
    };

    setAnnotations([...annotations, newAnnotation]);
    
    // Auto-open editing for new annotation
    setEditingId(newAnnotation.id);
    setEditDescription('');
    setSelectedAnnotationId(newAnnotation.id);
    
    // Auto-focus description input
    setTimeout(() => {
      descriptionInputRef.current?.focus();
    }, 50);
  };

  const handleSaveAnnotations = async () => {
    if (!selectedFile) {
      alert('Please select a drawing first');
      return;
    }

    if (annotations.length === 0) {
      alert('No annotations to save');
      return;
    }

    setLoading(true);
    try {
      await logEvent({
        ppap_id: ppapId,
        event_type: 'DOCUMENT_ADDED',
        event_data: {
          type: 'markup',
          file_path: selectedFile,
          annotations,
          markup: true,
        },
        actor: 'System User',
        actor_role: 'Engineer',
      });

      alert('Annotations saved successfully!');
    } catch (error) {
      console.error('Failed to save annotations:', error);
      alert('Failed to save annotations');
    } finally {
      setLoading(false);
    }
  };

  const handleExportMarkup = async () => {
    // Client-only execution guard
    if (typeof window === 'undefined') return;

    if (!selectedFile) {
      alert('Please select a drawing first');
      return;
    }

    if (!fileUrl) {
      console.error('Signed URL missing');
      alert('Drawing could not be loaded for export. Please try reloading the page.');
      return;
    }

    if (annotations.length === 0) {
      alert('No annotations to export');
      return;
    }

    if (!exportRef.current) {
      alert('Export target not ready');
      return;
    }

    setExporting(true);
    try {
      // Dynamic import of browser-safe PDF libraries
      const [html2canvasModule, jsPdfModule] = await Promise.all([
        import('html2canvas'),
        import('jspdf')
      ]);

      const html2canvas = html2canvasModule.default;
      const jsPdfAny = jsPdfModule as any;
      const jsPDF = jsPdfAny.jsPDF || jsPdfAny.default?.jsPDF || jsPdfAny.default;

      // Validate image exists and is loaded
      const img = exportRef.current?.querySelector('img');
      
      if (!img) {
        throw new Error('No image found in export container');
      }

      if (!(img instanceof HTMLImageElement)) {
        throw new Error('Image element is not valid');
      }

      // Wait for image to fully load if not complete
      if (!img.complete) {
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Image load timeout'));
          }, 10000);
          
          img.onload = () => {
            clearTimeout(timeout);
            resolve();
          };
          img.onerror = () => {
            clearTimeout(timeout);
            reject(new Error('Image failed to load'));
          };
        });
      }

      // Validate image actually loaded with content
      if (img.naturalWidth === 0 || img.naturalHeight === 0) {
        throw new Error('Image loaded but has no dimensions - CORS or load failure');
      }

      // Debug logging
      console.log({
        fileUrl,
        imgLoaded: img.complete,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        crossOrigin: img.crossOrigin,
      });

      // Capture exportRef directly (no cloning)
      const canvas = await html2canvas(exportRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#ffffff',
        logging: false,
      });

      const imgData = canvas.toDataURL('image/png');

      // Create PDF with standard page size
      const orientation = canvas.width > canvas.height ? 'landscape' : 'portrait';
      const pdf = new jsPDF({
        orientation,
        unit: 'pt',
        format: 'letter',
      });

      // Get page dimensions
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      
      // Calculate margins and available space
      const margin = 40;
      const availableWidth = pageWidth - (margin * 2);
      const availableHeight = pageHeight - (margin * 2);
      
      // Calculate fitted dimensions preserving aspect ratio
      const imgAspect = canvas.width / canvas.height;
      const availableAspect = availableWidth / availableHeight;
      
      let imgWidth, imgHeight;
      if (imgAspect > availableAspect) {
        // Image is wider - fit to width
        imgWidth = availableWidth;
        imgHeight = availableWidth / imgAspect;
      } else {
        // Image is taller - fit to height
        imgHeight = availableHeight;
        imgWidth = availableHeight * imgAspect;
      }
      
      // Center the image
      const xOffset = (pageWidth - imgWidth) / 2;
      const yOffset = (pageHeight - imgHeight) / 2;

      // Add annotated drawing
      pdf.addImage(imgData, 'PNG', xOffset, yOffset, imgWidth, imgHeight);

      // Add annotation sheet page
      pdf.addPage('letter', 'portrait');

      const fileName = uploadedFiles.find(f => f.file_path === selectedFile)?.file_name || 'Drawing';
      const sortedAnnotations = [...annotations].sort((a, b) => a.label_number - b.label_number);

      // Generate annotation sheet
      let y = 50;

      pdf.setFontSize(16);
      pdf.text('PPAP Markup - Annotation Sheet', 40, y);

      y += 25;
      pdf.setFontSize(10);
      pdf.text(`Drawing: ${String(fileName)}`, 40, y);
      y += 14;
      pdf.text(`Part Number: ${String(partNumber || 'N/A')}`, 40, y);
      y += 14;
      pdf.text(`Date: ${new Date().toLocaleDateString()}`, 40, y);
      y += 14;
      pdf.text(`Total Annotations: ${annotations.length}`, 40, y);

      y += 25;

      // Add annotations with ASCII-safe labels
      sortedAnnotations.forEach((ann, index) => {
        const markerLabel = getMarkerLabel(ann.shape);
        const typeShorthand = getTypeShorthand(ann.type);
        const description = String(ann.description || 'No description');
        
        pdf.setFontSize(10);
        pdf.setFont(undefined, 'normal');
        // Compact format: "1. CIRCLE [DIM] Hole center reference"
        const annotationLine = `${ann.label_number}. ${markerLabel} ${typeShorthand} ${description}`;
        pdf.text(annotationLine, 40, y);

        y += 16;

        // Add new page if needed
        if (y > 720 && index < sortedAnnotations.length - 1) {
          pdf.addPage();
          y = 50;
        }
      });

      // Save PDF
      pdf.save(`ppap-markup-${partNumber || 'drawing'}-${Date.now()}.pdf`);

      alert('Export complete!');
    } catch (error) {
      console.error('Export failed:', error);
      
      // Provide specific error message based on failure point
      let errorMessage = 'Export failed. Please try again.';
      if (error instanceof Error) {
        if (error.message.includes('Image')) {
          errorMessage = 'Export failed while rendering drawing page. Please ensure the drawing is fully loaded.';
        } else if (error.message.includes('annotation')) {
          errorMessage = 'Export failed while generating annotation sheet.';
        } else {
          errorMessage = `Export failed: ${error.message}`;
        }
      }
      
      alert(errorMessage);
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteAnnotation = (id: string) => {
    setAnnotations(annotations.filter(a => a.id !== id));
    if (selectedAnnotationId === id) {
      setSelectedAnnotationId(null);
    }
  };

  const handleInlineUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const path = await uploadPPAPDocument(file, ppapId);

      await logEvent({
        ppap_id: ppapId,
        event_type: 'DOCUMENT_ADDED',
        event_data: {
          file_name: file.name,
          file_path: path,
          document_type: 'drawing',
        },
        actor: 'System User',
        actor_role: 'Engineer',
      });

      // Refresh documents
      const docs = await getPPAPDocuments(ppapId);
      console.log('Documents refreshed after upload:', docs);
      setUploadedFiles(docs);

      // Auto-select new file
      setSelectedFile(path);

      alert('Drawing uploaded successfully!');
    } catch (error) {
      console.error('Failed to upload drawing:', error);
      alert('Failed to upload drawing');
    } finally {
      setUploading(false);
    }
  };

  const handleEditAnnotation = (id: string) => {
    const annotation = annotations.find(a => a.id === id);
    if (annotation) {
      setEditingId(id);
      setEditDescription(annotation.description);
    }
  };

  const handleSaveEdit = () => {
    if (!editingId) return;

    setAnnotations(annotations.map(a =>
      a.id === editingId ? { ...a, description: editDescription } : a
    ));
    setEditingId(null);
    setEditDescription('');
  };

  // Hard render guard - prevent premature render
  const hasValidSelection =
    typeof selectedFile === 'string' &&
    selectedFile.length > 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-2xl w-[95vw] h-[95vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Drawing Markup Tool</h2>
            <p className="text-sm text-gray-600">Part: {partNumber || ''}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Drawing:</label>
              <select
                value={selectedFile || ''}
                onChange={(e) => setSelectedFile(e.target.value)}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded"
              >
                {uploadedFiles.length === 0 && (
                  <option value="">No drawings uploaded yet</option>
                )}
                {uploadedFiles.map(file => (
                  <option key={file.file_path} value={file.file_path}>
                    {file.file_name}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              ✕ Close
            </button>
          </div>
        </div>

        <div className="flex-1 relative overflow-hidden">
          {/* Floating Left Tool Panel */}
          {leftPanelOpen ? (
            <div className="absolute top-4 left-4 z-40 bg-white/95 backdrop-blur border rounded-lg shadow-lg w-56 max-h-[calc(100vh-200px)] overflow-y-auto pointer-events-auto export-hide">
              <div className="flex justify-between items-center px-3 py-2 border-b">
                <span className="text-sm font-semibold text-gray-900">Tools</span>
                <button
                  onClick={() => setLeftPanelOpen(false)}
                  className="text-gray-500 hover:text-gray-700 text-lg leading-none"
                  title="Close panel"
                >
                  ✕
                </button>
              </div>
              <div className="p-3 space-y-3">
                  {/* Mode Controls */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">Mode</label>
                    <div className="space-y-1">
                      {(['navigate', 'markup', 'select'] as InteractionMode[]).map(m => (
                        <button
                          key={m}
                          onClick={() => setMode(m)}
                          className={`w-full px-3 py-2 rounded text-sm font-medium transition-colors text-left ${
                            mode === m
                              ? 'bg-blue-600 text-white'
                              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          {MODE_INFO[m].icon} {MODE_INFO[m].label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Type Selector */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">Type</label>
                    <select
                      value={selectedType}
                      onChange={(e) => setSelectedType(e.target.value as AnnotationType)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded"
                    >
                      <option value="dimension">🔵 Dimension</option>
                      <option value="note">🟡 Note</option>
                      <option value="material">🟢 Material</option>
                      <option value="critical">🔴 Critical</option>
                    </select>
                  </div>

                  {/* Tool Selector */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">Tool</label>
                    <select
                      value={selectedTool}
                      onChange={(e) => setSelectedTool(e.target.value as AnnotationShape)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded"
                    >
                      <option value="circle">⭕ Circle</option>
                      <option value="box">⬜ Box</option>
                      <option value="triangle">🔺 Triangle</option>
                      <option value="arrow">➡️ Arrow</option>
                      <option value="text">📝 Text</option>
                    </select>
                  </div>

                  {/* Action Buttons */}
                  <div className="pt-2 space-y-2">
                    <button
                      onClick={handleSaveAnnotations}
                      disabled={loading}
                      className="w-full px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors font-medium text-sm"
                    >
                      {loading ? 'Saving...' : '💾 Save Annotations'}
                    </button>
                    <button
                      onClick={handleExportMarkup}
                      disabled={exporting || !selectedFile || annotations.length === 0}
                      className="w-full px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition-colors font-medium text-sm"
                      title="Export marked-up drawing and annotation sheet"
                    >
                      {exporting ? 'Exporting...' : '📦 Export Package'}
                    </button>
                  </div>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setLeftPanelOpen(true)}
              className="absolute top-4 left-4 z-40 bg-blue-600 text-white px-3 py-2 rounded shadow-lg hover:bg-blue-700 transition-colors pointer-events-auto export-hide"
              title="Open tools panel"
            >
              ▶ Tools
            </button>
          )}

          {/* Full-Height Canvas Area */}
          <div className="relative w-full h-screen overflow-hidden bg-gray-100">
            <div className="absolute inset-0 overflow-auto p-6">
              {/* Mode Indicator */}
              {selectedFile && (
                <div className={`px-4 py-2 text-sm font-semibold rounded-lg mb-2 export-hide ${
                  mode === 'navigate' ? 'bg-gray-100 border border-gray-300 text-gray-800' :
                  mode === 'markup' ? 'bg-blue-50 border border-blue-300 text-blue-800' :
                  'bg-purple-50 border border-purple-300 text-purple-800'
                }`}>
                  {MODE_INFO[mode].icon} {MODE_INFO[mode].label} Mode: {MODE_INFO[mode].description}
                </div>
              )}

              {/* Drawing Canvas */}
              <div
                ref={containerRef}
                className={`relative mx-auto min-h-full flex justify-center ${
                  mode === 'navigate' ? 'cursor-default' :
                  mode === 'markup' ? 'cursor-crosshair' :
                  'cursor-pointer'
                }`}
                onMouseMove={handleAnnotationDrag}
                onMouseUp={handleAnnotationDragEnd}
                onMouseLeave={handleAnnotationDragEnd}
              >
                <div ref={exportRef} className="relative w-full max-w-[1200px]">
                {/* Document Display */}
                <div className={`w-full h-full ${
                  mode === 'navigate' ? 'pointer-events-auto' : 'pointer-events-none'
                }`}>
                  {!hasValidSelection ? (
                    <div className="absolute inset-0 flex items-center justify-center border-2 border-dashed border-gray-300 bg-gray-50 pointer-events-auto">
                      <div className="text-center p-8">
                        <svg className="mx-auto h-16 w-16 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        <p className="text-lg font-semibold text-gray-900 mb-2">No Drawing Loaded</p>
                        <p className="text-sm text-gray-500 mb-4">
                          {uploadedFiles.length === 0 
                            ? "Upload a drawing to begin markup"
                            : "Preparing drawing..."}
                        </p>
                        {uploadedFiles.length === 0 && (
                          <div>
                            <input
                              type="file"
                              accept=".pdf,.png,.jpg,.jpeg"
                              onChange={handleInlineUpload}
                              disabled={uploading}
                              className="hidden"
                              id="inline-upload"
                            />
                            <label
                              htmlFor="inline-upload"
                              className={`inline-block px-6 py-3 bg-blue-600 text-white rounded-lg font-medium cursor-pointer hover:bg-blue-700 transition-colors ${
                                uploading ? 'opacity-50 cursor-not-allowed' : ''
                              }`}
                            >
                              {uploading ? 'Uploading...' : '📁 Upload Drawing'}
                            </label>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : fileUrl ? (
                    selectedFile.endsWith('.pdf') ? (
                      <iframe
                        src={fileUrl}
                        className="w-full h-full"
                        title="Drawing Document"
                      />
                    ) : (
                      <img
                        ref={imageRef}
                        src={fileUrl}
                        crossOrigin="anonymous"
                        referrerPolicy="no-referrer"
                        alt="Drawing"
                        className="max-w-[1200px] w-full h-auto object-contain"
                      />
                    )
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-500">
                      Loading drawing...
                    </div>
                  )}
                </div>

                {/* Click Capture Layer - only active in markup mode */}
                {mode === 'markup' && (
                  <div
                    className="absolute inset-0"
                    onClick={handleCanvasClick}
                  />
                )}

                {/* Annotations Overlay */}
                <div className="absolute inset-0 pointer-events-none">
                {annotations.map((annotation) => {
                  const isSelected = selectedAnnotationId === annotation.id;
                  const borderWidth = isSelected ? 'border-2' : 'border-[1.5px]';
                  const textColor = 'text-gray-900';
                  const hoverScale = 'hover:scale-110 transition-transform';
                  
                  return (
                  <div
                    key={annotation.id}
                    className="absolute pointer-events-auto"
                    style={{
                      left: `${annotation.x * 100}%`,
                      top: `${annotation.y * 100}%`,
                      transform: 'translate(-50%, -50%)',
                    }}
                  >
                    {annotation.shape === 'circle' && (
                      <div
                        className={`w-4 h-4 rounded-full border-2 ${TYPE_COLORS[annotation.type]} bg-white bg-opacity-75 flex items-center justify-center font-bold text-[10px] shadow cursor-${draggingAnnotationId === annotation.id ? 'grabbing' : 'grab'} ${hoverScale} ${textColor}`}
                        onMouseDown={(e) => handleAnnotationDragStart(e, annotation.id)}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!draggingAnnotationId) {
                            setSelectedAnnotationId(annotation.id);
                            handleEditAnnotation(annotation.id);
                          }
                        }}
                      >
                        {annotation.label_number}
                      </div>
                    )}
                    {annotation.shape === 'box' && (
                      <div
                        className={`w-4 h-4 border-2 ${TYPE_COLORS[annotation.type]} bg-white bg-opacity-75 flex items-center justify-center font-bold text-[10px] shadow cursor-${draggingAnnotationId === annotation.id ? 'grabbing' : 'grab'} ${hoverScale} ${textColor}`}
                        onMouseDown={(e) => handleAnnotationDragStart(e, annotation.id)}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!draggingAnnotationId) {
                            setSelectedAnnotationId(annotation.id);
                            handleEditAnnotation(annotation.id);
                          }
                        }}
                      >
                        {annotation.label_number}
                      </div>
                    )}
                    {annotation.shape === 'triangle' && (
                      <div
                        className={`relative w-6 h-6 cursor-${draggingAnnotationId === annotation.id ? 'grabbing' : 'grab'} ${hoverScale}`}
                        onMouseDown={(e) => handleAnnotationDragStart(e, annotation.id)}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!draggingAnnotationId) {
                            setSelectedAnnotationId(annotation.id);
                            handleEditAnnotation(annotation.id);
                          }
                        }}
                      >
                        <div
                          className={`absolute inset-0 ${borderWidth} ${TYPE_COLORS[annotation.type]} bg-white bg-opacity-75 flex items-center justify-center shadow`}
                          style={{ clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)' }}
                        >
                          <span className={`font-bold text-xs ${textColor} mt-1`}>{annotation.label_number}</span>
                        </div>
                      </div>
                    )}
                    {annotation.shape === 'arrow' && (
                      <div
                        className={`relative cursor-${draggingAnnotationId === annotation.id ? 'grabbing' : 'grab'} ${hoverScale}`}
                        onMouseDown={(e) => handleAnnotationDragStart(e, annotation.id)}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!draggingAnnotationId) {
                            setSelectedAnnotationId(annotation.id);
                            handleEditAnnotation(annotation.id);
                          }
                        }}
                      >
                        <svg width="28" height="20" viewBox="0 0 28 20" className="drop-shadow">
                          <defs>
                            <marker id={`arrowhead-${annotation.id}`} markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                              <polygon points="0 0, 6 3, 0 6" className={TYPE_COLORS[annotation.type]} fill="currentColor" />
                            </marker>
                          </defs>
                          <line 
                            x1="2" y1="10" x2="22" y2="10" 
                            className={TYPE_COLORS[annotation.type]} 
                            stroke="currentColor" 
                            strokeWidth={isSelected ? "2" : "1.5"}
                            markerEnd={`url(#arrowhead-${annotation.id})`}
                          />
                          <circle cx="2" cy="10" r="6" className={`${TYPE_COLORS[annotation.type]} bg-white`} fill="white" fillOpacity="0.75" stroke="currentColor" strokeWidth={isSelected ? "2" : "1.5"} />
                          <text x="2" y="10" textAnchor="middle" dominantBaseline="middle" className="font-bold text-xs fill-gray-900">
                            {annotation.label_number}
                          </text>
                        </svg>
                      </div>
                    )}
                    {annotation.shape === 'text' && (
                      <div
                        className={`px-2 py-1 ${borderWidth} ${TYPE_COLORS[annotation.type]} bg-white bg-opacity-80 rounded shadow cursor-${draggingAnnotationId === annotation.id ? 'grabbing' : 'grab'} ${hoverScale} max-w-[150px]`}
                        onMouseDown={(e) => handleAnnotationDragStart(e, annotation.id)}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!draggingAnnotationId) {
                            setSelectedAnnotationId(annotation.id);
                            handleEditAnnotation(annotation.id);
                          }
                        }}
                      >
                        <div className={`font-bold text-[10px] mb-0.5 ${textColor}`}>#{annotation.label_number}</div>
                        {annotation.description && String(annotation.description).trim() && (
                          <div className={`text-[10px] leading-tight ${textColor}`}>
                            {String(annotation.description).substring(0, 40)}{String(annotation.description).length > 40 ? '...' : ''}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>
            </div>
          </div>
          </div>
          </div>

          {/* Floating Right Annotation Panel */}
          {rightPanelOpen ? (
            <div className="absolute top-4 right-4 z-40 w-80 max-h-[80vh] overflow-auto bg-white border rounded-lg shadow-lg pointer-events-auto export-hide">
              <div className="flex justify-between items-center px-4 py-3 border-b">
                <h3 className="text-base font-bold text-gray-900">
                  Annotations ({annotations.length})
                </h3>
                <button
                  onClick={() => setRightPanelOpen(false)}
                  className="text-gray-500 hover:text-gray-700 text-lg leading-none"
                  title="Close panel"
                >
                  ✕
                </button>
              </div>
              <div className="p-4">

              {annotations.length === 0 && (
                <p className="text-sm text-gray-500 italic">No annotations yet. Click on the drawing to add one.</p>
              )}

              <div className="space-y-3">
                {annotations.map((annotation) => (
                  <div
                    key={annotation.id}
                    className={`p-4 bg-white rounded-lg transition-all ${
                      selectedAnnotationId === annotation.id
                        ? 'border-2 border-blue-500 shadow-md'
                        : 'border border-gray-200'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-6 h-6 ${annotation.shape === 'circle' ? 'rounded-full' : ''} ${TYPE_COLORS[annotation.type]} flex items-center justify-center text-white font-bold text-xs`}
                        >
                          {annotation.label_number}
                        </span>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium capitalize text-gray-700">
                            {annotation.type || 'dimension'}
                          </span>
                          <span className="text-xs text-gray-500 capitalize">
                            {annotation.shape || 'circle'}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteAnnotation(annotation.id)}
                        className="text-red-600 hover:text-red-800 text-xs"
                      >
                        Delete
                      </button>
                    </div>

                    {editingId === annotation.id ? (
                      <div className="space-y-2">
                        <textarea
                          ref={descriptionInputRef}
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          placeholder="Add description..."
                          rows={3}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={handleSaveEdit}
                            className="flex-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => {
                              setEditingId(null);
                              setEditDescription('');
                            }}
                            className="flex-1 px-2 py-1 text-xs bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <p className="text-sm text-gray-600">
                          {String(annotation.description || '') || <em className="text-gray-400">No description</em>}
                        </p>
                        <button
                          onClick={() => handleEditAnnotation(annotation.id)}
                          className="mt-2 text-xs text-blue-600 hover:text-blue-800"
                        >
                          Edit
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setRightPanelOpen(true)}
              className="absolute top-4 right-4 z-40 bg-gray-700 text-white px-3 py-2 rounded shadow-lg hover:bg-gray-800 transition-colors pointer-events-auto export-hide"
              title="Open annotations panel"
            >
              Annotations ◀
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
