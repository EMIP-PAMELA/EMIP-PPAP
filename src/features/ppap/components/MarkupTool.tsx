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
  navigate: { label: 'Navigate', description: 'Inspect drawing', icon: '🔍' },
  markup: { label: 'Markup', description: 'Click to place annotation', icon: '✏️' },
  select: { label: 'Select', description: 'Edit existing annotations', icon: '👆' },
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
  const containerRef = useRef<HTMLDivElement>(null);
  const descriptionInputRef = useRef<HTMLTextAreaElement>(null);

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

        // Filter to only file uploads (not markup events)
        const files: UploadedFile[] = (data || [])
          .filter(event => event.event_data.file_name && !event.event_data.markup)
          .map(event => ({
            file_name: event.event_data.file_name,
            file_path: event.event_data.file_path,
          }));

        setUploadedFiles(files);
        
        // Auto-select first file if available
        if (files.length > 0 && !selectedFile) {
          setSelectedFile(files[0].file_path);
        }
      } catch (error) {
        console.error('Failed to fetch files:', error);
      }
    };

    fetchFiles();
  }, [ppapId, selectedFile]);

  // Generate signed URL when file is selected
  useEffect(() => {
    const loadFileUrl = async () => {
      if (!selectedFile || typeof selectedFile !== 'string') {
        console.log('Selected file:', selectedFile);
        setFileUrl(null);
        return;
      }

      console.log('Selected file:', selectedFile);

      const { data, error } = await supabase.storage
        .from('ppap-documents')
        .createSignedUrl(selectedFile, 3600); // 1 hour

      console.log('Signed URL result:', data, error);

      if (error) {
        console.error('Supabase signed URL error:', error);
        setFileUrl(null);
        return;
      }

      setFileUrl(data?.signedUrl || null);
    };

    loadFileUrl();
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
    const x = ((e.clientX - rect.left) / rect.width) * 100; // Store as percentage
    const y = ((e.clientY - rect.top) / rect.height) * 100;

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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-2xl w-[95vw] h-[95vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Drawing Markup Tool</h2>
            <p className="text-sm text-gray-600">Part: {partNumber || ''}</p>
            {selectedFile && (
              <p className="text-sm font-medium text-blue-600 mt-1">
                Marking up: {uploadedFiles.find(f => f.file_path === selectedFile)?.file_name || 'Unknown file'}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            ✕ Close
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Main Canvas Area */}
          <div className="flex-1 p-6 overflow-auto">
            {/* Toolbar */}
            <div className="mb-4 p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-3">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <label className="text-sm font-medium text-gray-700 mr-2">Select Drawing:</label>
                  <select
                    value={selectedFile || ''}
                    onChange={(e) => setSelectedFile(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded w-full max-w-md"
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
              </div>
              
              {/* Mode Controls */}
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700 mr-2">Mode:</label>
                {(['navigate', 'markup', 'select'] as InteractionMode[]).map(m => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      mode === m
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {MODE_INFO[m].icon} {MODE_INFO[m].label}
                  </button>
                ))}
              </div>
              
              <div className="flex items-center gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mr-2">Type:</label>
                  <select
                    value={selectedType}
                    onChange={(e) => setSelectedType(e.target.value as AnnotationType)}
                    className="px-3 py-1 border border-gray-300 rounded"
                  >
                    <option value="dimension">Dimension (Blue)</option>
                    <option value="note">Note (Yellow)</option>
                    <option value="material">Material (Green)</option>
                    <option value="critical">Critical (Red)</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mr-2">Tool:</label>
                  <select
                    value={selectedTool}
                    onChange={(e) => setSelectedTool(e.target.value as AnnotationShape)}
                    className="px-3 py-1 border border-gray-300 rounded"
                  >
                    <option value="circle">Circle</option>
                    <option value="box">Box</option>
                    <option value="triangle">Triangle</option>
                    <option value="arrow">Arrow</option>
                    <option value="text">Text</option>
                  </select>
                </div>
                <div className="flex-1"></div>
                <button
                  onClick={handleSaveAnnotations}
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
                >
                  {loading ? 'Saving...' : '💾 Save Annotations'}
                </button>
              </div>
            </div>

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
              className="relative bg-gray-100 border-2 border-gray-300 rounded-lg overflow-hidden cursor-crosshair"
              style={{ width: '100%', paddingBottom: '75%' }}
            >
              {/* Document Display */}
              <div className="absolute inset-0 pointer-events-none">
                {typeof fileUrl === 'string' && fileUrl.length > 0 ? (
                  typeof selectedFile === 'string' && selectedFile.endsWith('.pdf') ? (
                    <iframe
                      src={fileUrl}
                      className="w-full h-full"
                      title="Drawing Document"
                    />
                  ) : (
                    <img
                      src={fileUrl}
                      alt="Drawing"
                      className="w-full h-full object-contain"
                    />
                  )
                ) : selectedFile ? (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    Loading document...
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center text-gray-400">
                      <svg className="mx-auto h-24 w-24 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <p className="text-sm font-medium">Select a drawing to begin</p>
                      <p className="text-xs mt-1">Upload drawings in the Documentation phase, then select one above</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Click Capture Layer */}
              <div
                className="absolute inset-0"
                onClick={handleCanvasClick}
              />

              {/* Annotations Overlay */}
              <div className="absolute inset-0 pointer-events-none">
                {annotations.map((annotation) => {
                  const isSelected = selectedAnnotationId === annotation.id;
                  const baseClasses = `${TYPE_COLORS[annotation.type]} flex items-center justify-center font-bold text-sm shadow-lg cursor-pointer hover:scale-110 transition-transform`;
                  const bgOpacity = isSelected ? 'bg-opacity-40' : 'bg-opacity-25';
                  const borderWidth = isSelected ? 'border-3' : 'border-2';
                  
                  return (
                  <div
                    key={annotation.id}
                    className="absolute pointer-events-auto"
                    style={{
                      left: `${annotation.x}%`,
                      top: `${annotation.y}%`,
                      transform: 'translate(-50%, -50%)',
                    }}
                  >
                    {annotation.shape === 'circle' && (
                      <div
                        className={`w-10 h-10 rounded-full ${borderWidth} ${baseClasses} ${bgOpacity} text-gray-900`}
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
                        className={`w-10 h-10 ${borderWidth} ${baseClasses} ${bgOpacity} text-gray-900`}
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
                        className={`w-10 h-10 ${borderWidth} ${baseClasses} ${bgOpacity} text-gray-900`}
                        style={{ clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedAnnotationId(annotation.id);
                          handleEditAnnotation(annotation.id);
                        }}
                      >
                        <span className="mt-3">{annotation.label_number}</span>
                      </div>
                    )}
                    {annotation.shape === 'arrow' && (
                      <div
                        className={`relative w-12 h-8 ${borderWidth} ${baseClasses} ${bgOpacity} text-gray-900 rounded`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedAnnotationId(annotation.id);
                          handleEditAnnotation(annotation.id);
                        }}
                      >
                        <span className="absolute inset-0 flex items-center justify-center">→{annotation.label_number}</span>
                      </div>
                    )}
                    {annotation.shape === 'text' && (
                      <div
                        className={`px-3 py-2 ${borderWidth} ${baseClasses} ${bgOpacity} text-gray-900 rounded-lg max-w-xs`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedAnnotationId(annotation.id);
                          handleEditAnnotation(annotation.id);
                        }}
                      >
                        <div className="font-bold text-xs mb-1">#{annotation.label_number}</div>
                        {annotation.description && (
                          <div className="text-xs leading-tight">{annotation.description.substring(0, 30)}{annotation.description.length > 30 ? '...' : ''}</div>
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
