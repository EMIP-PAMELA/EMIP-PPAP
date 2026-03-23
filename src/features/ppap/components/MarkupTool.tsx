'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/src/lib/supabaseClient';
import { logEvent } from '@/src/features/events/mutations';

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
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const descriptionInputRef = useRef<HTMLTextAreaElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Load uploaded files
  useEffect(() => {
    const fetchFiles = async () => {
      try {
        const { data, error } = await supabase
          .from('ppap_events')
          .select('event_data')
          .eq('ppap_id', ppapId)
          .eq('event_type', 'DOCUMENT_ADDED')
          .order('created_at', { ascending: false });

        if (error) throw error;

        // Filter to only file uploads (not markup events) and validate file_path
        const files: UploadedFile[] = (data || [])
          .filter(event => 
            event.event_data.file_name && 
            !event.event_data.markup &&
            event.event_data.file_path &&
            typeof event.event_data.file_path === 'string'
          )
          .map(event => ({
            file_name: event.event_data.file_name,
            file_path: event.event_data.file_path,
          }));

        setUploadedFiles(files);
      } catch (error) {
        console.error('Failed to fetch files:', error);
      }
    };

    fetchFiles();
  }, [ppapId]);

  // Auto-select first file when uploadedFiles changes
  useEffect(() => {
    if (uploadedFiles.length > 0) {
      const firstFile = uploadedFiles[0]?.file_path;

      if (typeof firstFile === 'string') {
        setSelectedFile((prev) =>
          typeof prev === 'string' ? prev : firstFile
        );
      }
    }
  }, [uploadedFiles]);

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

  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Only allow annotation placement in markup mode
    if (mode !== 'markup') return;
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left - offset.x) / (rect.width * scale);
    const y = (e.clientY - rect.top - offset.y) / (rect.height * scale);

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
    if (!selectedFile) {
      alert('Please select a drawing first');
      return;
    }

    if (annotations.length === 0) {
      alert('No annotations to export');
      return;
    }

    setExporting(true);
    try {
      // Create a new window for the export
      const exportWindow = window.open('', '_blank');
      if (!exportWindow) {
        alert('Please allow popups to export markup');
        return;
      }

      // Generate markup export HTML
      const fileName = uploadedFiles.find(f => f.file_path === selectedFile)?.file_name || 'Drawing';
      const sortedAnnotations = [...annotations].sort((a, b) => a.label_number - b.label_number);

      const exportHTML = `
<!DOCTYPE html>
<html>
<head>
  <title>Markup Export - ${fileName}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      margin: 0;
      padding: 20px;
      background: #f5f5f5;
    }
    .page {
      background: white;
      max-width: 1200px;
      margin: 0 auto 20px;
      padding: 40px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    h1 {
      margin: 0 0 10px;
      font-size: 24px;
      color: #1f2937;
    }
    .metadata {
      color: #6b7280;
      font-size: 14px;
      margin-bottom: 20px;
      padding-bottom: 20px;
      border-bottom: 2px solid #e5e7eb;
    }
    .drawing-container {
      position: relative;
      width: 100%;
      margin-bottom: 40px;
      border: 2px solid #d1d5db;
      background: #f9fafb;
    }
    .drawing-img {
      width: 100%;
      height: auto;
      display: block;
    }
    .annotation-overlay {
      position: absolute;
      inset: 0;
      pointer-events: none;
    }
    .annotation-marker {
      position: absolute;
      transform: translate(-50%, -50%);
      pointer-events: none;
    }
    .marker-circle, .marker-box, .marker-triangle {
      width: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      font-size: 11px;
      background: rgba(255, 255, 255, 0.75);
      border-width: 1.5px;
      border-style: solid;
    }
    .marker-circle { border-radius: 50%; }
    .marker-triangle {
      clip-path: polygon(50% 0%, 0% 100%, 100% 100%);
      padding-top: 4px;
    }
    .type-dimension { border-color: #2563eb; color: #1e40af; }
    .type-note { border-color: #ca8a04; color: #a16207; }
    .type-material { border-color: #16a34a; color: #15803d; }
    .type-critical { border-color: #dc2626; color: #b91c1c; }
    .annotation-list {
      page-break-before: always;
    }
    h2 {
      font-size: 20px;
      color: #1f2937;
      margin: 0 0 20px;
      padding-bottom: 10px;
      border-bottom: 2px solid #e5e7eb;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
    }
    th, td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid #e5e7eb;
    }
    th {
      background: #f9fafb;
      font-weight: 600;
      color: #374151;
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    td {
      color: #1f2937;
      font-size: 14px;
    }
    .type-badge {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
    }
    .badge-dimension { background: #dbeafe; color: #1e40af; }
    .badge-note { background: #fef3c7; color: #a16207; }
    .badge-material { background: #dcfce7; color: #15803d; }
    .badge-critical { background: #fee2e2; color: #b91c1c; }
    @media print {
      body { background: white; padding: 0; }
      .page { box-shadow: none; max-width: none; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="page">
    <h1>PPAP Markup - ${fileName}</h1>
    <div class="metadata">
      <div><strong>Part Number:</strong> ${partNumber || 'N/A'}</div>
      <div><strong>PPAP ID:</strong> ${ppapId || 'N/A'}</div>
      <div><strong>Date:</strong> ${new Date().toLocaleDateString()}</div>
      <div><strong>Total Annotations:</strong> ${annotations.length}</div>
    </div>

    <div class="drawing-container">
      <img src="${fileUrl}" alt="Drawing" class="drawing-img" />
      <div class="annotation-overlay">
        ${sortedAnnotations.map(ann => {
          const shapeClass = ann.shape === 'circle' ? 'marker-circle' : ann.shape === 'box' ? 'marker-box' : ann.shape === 'triangle' ? 'marker-triangle' : '';
          if (ann.shape === 'text' || ann.shape === 'arrow') return ''; // Skip text and arrow for now
          return `
            <div class="annotation-marker" style="left: ${ann.x}%; top: ${ann.y}%;">
              <div class="${shapeClass} type-${ann.type}">
                ${ann.label_number}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  </div>

  <div class="page annotation-list">
    <h2>Annotation Legend</h2>
    <table>
      <thead>
        <tr>
          <th style="width: 60px;">#</th>
          <th style="width: 120px;">Type</th>
          <th style="width: 100px;">Shape</th>
          <th>Description</th>
        </tr>
      </thead>
      <tbody>
        ${sortedAnnotations.map(ann => `
          <tr>
            <td><strong>${ann.label_number}</strong></td>
            <td><span class="type-badge badge-${ann.type}">${ann.type.toUpperCase()}</span></td>
            <td>${ann.shape}</td>
            <td>${ann.description || '<em>No description</em>'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>

  <div class="no-print" style="position: fixed; bottom: 20px; right: 20px; background: white; padding: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); border-radius: 8px;">
    <button onclick="window.print()" style="background: #2563eb; color: white; border: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; cursor: pointer; margin-right: 10px;">Print</button>
    <button onclick="window.close()" style="background: #6b7280; color: white; border: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; cursor: pointer;">Close</button>
  </div>
</body>
</html>
      `;

      exportWindow.document.write(exportHTML);
      exportWindow.document.close();
    } catch (error) {
      console.error('Failed to export markup:', error);
      alert('Failed to export markup');
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteAnnotation = (id: string) => {
    setAnnotations(annotations.filter(a => a.id !== id));
    if (editingId === id) {
      setEditingId(null);
      setEditDescription('');
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

        <div className="flex flex-1 overflow-hidden">
          {/* Left Tool Rail */}
          <div className={`border-r border-gray-200 bg-gray-50 transition-all duration-300 flex-shrink-0 ${
            isRailCollapsed ? 'w-12' : 'w-64'
          }`}>
            <div className="h-full flex flex-col">
              {/* Rail Toggle */}
              <div className="p-2 border-b border-gray-200">
                <button
                  onClick={() => setIsRailCollapsed(!isRailCollapsed)}
                  className="w-full p-2 hover:bg-gray-200 rounded transition-colors text-gray-700"
                  title={isRailCollapsed ? 'Expand tools' : 'Collapse tools'}
                >
                  {isRailCollapsed ? '☰' : '◀'}
                </button>
              </div>

              {/* Tools Content */}
              {!isRailCollapsed && (
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
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

                  {/* Zoom Controls */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">Zoom</label>
                    <div className="space-y-1">
                      <button
                        onClick={() => setScale(prev => Math.min(prev + 0.2, 3))}
                        className="w-full px-3 py-2 bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 rounded text-sm font-medium transition-colors"
                      >
                        🔍+ Zoom In
                      </button>
                      <button
                        onClick={() => setScale(prev => Math.max(prev - 0.2, 0.5))}
                        className="w-full px-3 py-2 bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 rounded text-sm font-medium transition-colors"
                      >
                        🔍- Zoom Out
                      </button>
                      <button
                        onClick={() => { setScale(1); setOffset({ x: 0, y: 0 }); }}
                        className="w-full px-3 py-2 bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 rounded text-sm font-medium transition-colors"
                      >
                        ↺ Reset View
                      </button>
                      <div className="text-center text-xs text-gray-600 mt-1">
                        {Math.round(scale * 100)}%
                      </div>
                    </div>
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
              )}
            </div>
          </div>

          {/* Center Canvas Area */}
          <div className="flex-1 p-6 overflow-auto">

            {/* Mode Indicator */}
            {selectedFile && (
              <div className={`px-4 py-2 text-sm font-semibold rounded-lg mb-2 ${
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
              className={`relative bg-gray-100 border-2 border-gray-300 rounded-lg overflow-hidden ${
                mode === 'navigate' ? 'cursor-default' :
                mode === 'markup' ? 'cursor-crosshair' :
                'cursor-pointer'
              }`}
              style={{ width: '100%', paddingBottom: '75%' }}
            >
              {/* Transformed Drawing and Annotations Container */}
              <div
                className="absolute inset-0"
                style={{
                  transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
                  transformOrigin: 'top left',
                }}
              >
                {/* Document Display */}
                <div className={`w-full h-full ${
                  mode === 'navigate' ? 'pointer-events-auto' : 'pointer-events-none'
                }`}>
                  {!hasValidSelection ? (
                    <div className="flex items-center justify-center h-full text-gray-500">
                      {uploadedFiles.length === 0
                        ? "No drawings uploaded yet"
                        : "Preparing drawing..."}
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
                        alt="Drawing"
                        className="w-full h-full object-contain"
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
                        className={`w-5 h-5 rounded-full ${borderWidth} ${TYPE_COLORS[annotation.type]} bg-white bg-opacity-75 flex items-center justify-center font-bold text-xs shadow cursor-pointer ${hoverScale} ${textColor}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedAnnotationId(annotation.id);
                          handleEditAnnotation(annotation.id);
                        }}
                      >
                        {annotation.label_number}
                      </div>
                    )}
                    {annotation.shape === 'box' && (
                      <div
                        className={`w-5 h-5 ${borderWidth} ${TYPE_COLORS[annotation.type]} bg-white bg-opacity-75 flex items-center justify-center font-bold text-xs shadow cursor-pointer ${hoverScale} ${textColor}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedAnnotationId(annotation.id);
                          handleEditAnnotation(annotation.id);
                        }}
                      >
                        {annotation.label_number}
                      </div>
                    )}
                    {annotation.shape === 'triangle' && (
                      <div
                        className={`relative w-5 h-5 cursor-pointer ${hoverScale}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedAnnotationId(annotation.id);
                          handleEditAnnotation(annotation.id);
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
                        className={`relative cursor-pointer ${hoverScale}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedAnnotationId(annotation.id);
                          handleEditAnnotation(annotation.id);
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
                        className={`px-2 py-1 ${borderWidth} ${TYPE_COLORS[annotation.type]} bg-white bg-opacity-80 rounded shadow cursor-pointer ${hoverScale} max-w-[150px]`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedAnnotationId(annotation.id);
                          handleEditAnnotation(annotation.id);
                        }}
                      >
                        <div className={`font-bold text-[10px] mb-0.5 ${textColor}`}>#{annotation.label_number}</div>
                        {annotation.description && annotation.description.trim() && (
                          <div className={`text-[10px] leading-tight ${textColor}`}>
                            {annotation.description.substring(0, 40)}{annotation.description.length > 40 ? '...' : ''}
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

          {/* Annotation Panel */}
          <div className="w-96 border-l border-gray-200 bg-gray-50 overflow-auto">
            <div className="p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">
                Annotations ({annotations.length})
              </h3>

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
                          {annotation.description || <em className="text-gray-400">No description</em>}
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
        </div>
      </div>
    </div>
  );
}
