'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/src/lib/supabaseClient';
import { logEvent } from '@/src/features/events/mutations';

interface MarkupToolProps {
  ppapId: string;
  partNumber: string;
  onClose: () => void;
}

type AnnotationType = 'dimension' | 'note' | 'material';
type AnnotationShape = 'circle' | 'box';

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
  dimension: 'bg-blue-500 border-blue-600',
  note: 'bg-yellow-500 border-yellow-600',
  material: 'bg-green-500 border-green-600',
};

export function MarkupTool({ ppapId, partNumber, onClose }: MarkupToolProps) {
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [selectedType, setSelectedType] = useState<AnnotationType>('dimension');
  const [selectedShape, setSelectedShape] = useState<AnnotationShape>('circle');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDescription, setEditDescription] = useState('');
  const [uploadedDrawing, setUploadedDrawing] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load existing annotations from events
  useEffect(() => {
    const fetchAnnotations = async () => {
      try {
        const { data, error } = await supabase
          .from('ppap_events')
          .select('event_data')
          .eq('ppap_id', ppapId)
          .eq('event_type', 'DOCUMENT_ADDED')
          .order('created_at', { ascending: false });

        if (error) throw error;

        // Find markup data (has annotations property)
        const markupEvent = data?.find(event => event.event_data.annotations);
        if (markupEvent && markupEvent.event_data.annotations) {
          setAnnotations(markupEvent.event_data.annotations);
        }
      } catch (error) {
        console.error('Failed to fetch annotations:', error);
      }
    };

    fetchAnnotations();
  }, [ppapId]);

  // Load uploaded drawing (placeholder for now - first image from uploads)
  useEffect(() => {
    const fetchDrawing = async () => {
      try {
        const { data, error } = await supabase
          .from('ppap_events')
          .select('event_data')
          .eq('ppap_id', ppapId)
          .eq('event_type', 'DOCUMENT_ADDED')
          .order('created_at', { ascending: false })
          .limit(1);

        if (error) throw error;

        if (data && data.length > 0) {
          // For now, just show placeholder - would need to fetch actual file
          setUploadedDrawing('placeholder');
        }
      } catch (error) {
        console.error('Failed to fetch drawing:', error);
      }
    };

    fetchDrawing();
  }, [ppapId]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100; // Store as percentage
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    const newAnnotation: Annotation = {
      id: `annotation-${Date.now()}`,
      x,
      y,
      label_number: annotations.length + 1,
      type: selectedType,
      shape: selectedShape,
      description: '',
    };

    setAnnotations([...annotations, newAnnotation]);
  };

  const handleSaveAnnotations = async () => {
    setLoading(true);
    try {
      await logEvent({
        ppap_id: ppapId,
        event_type: 'DOCUMENT_ADDED',
        event_data: {
          annotations,
          markup: true, // Flag to identify markup events
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
            <div className="mb-4 p-4 bg-gray-50 border border-gray-200 rounded-lg flex items-center gap-4">
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
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mr-2">Shape:</label>
                <select
                  value={selectedShape}
                  onChange={(e) => setSelectedShape(e.target.value as AnnotationShape)}
                  className="px-3 py-1 border border-gray-300 rounded"
                >
                  <option value="circle">Circle</option>
                  <option value="box">Box</option>
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

            {/* Drawing Canvas */}
            <div
              ref={containerRef}
              onClick={handleCanvasClick}
              className="relative bg-gray-100 border-2 border-gray-300 rounded-lg overflow-hidden cursor-crosshair"
              style={{ width: '100%', paddingBottom: '75%' }}
            >
              {/* Placeholder for drawing */}
              {!uploadedDrawing && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center text-gray-400">
                    <svg className="mx-auto h-24 w-24 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className="text-sm font-medium">Click to add annotations</p>
                    <p className="text-xs mt-1">Upload a drawing in Documentation to mark it up</p>
                  </div>
                </div>
              )}

              {/* Annotations Overlay */}
              {annotations.map((annotation) => (
                <div
                  key={annotation.id}
                  className="absolute"
                  style={{
                    left: `${annotation.x}%`,
                    top: `${annotation.y}%`,
                    transform: 'translate(-50%, -50%)',
                  }}
                >
                  {annotation.shape === 'circle' ? (
                    <div
                      className={`w-8 h-8 rounded-full border-2 ${TYPE_COLORS[annotation.type]} flex items-center justify-center text-white font-bold text-sm shadow-lg cursor-pointer hover:scale-110 transition-transform`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditAnnotation(annotation.id);
                      }}
                    >
                      {annotation.label_number}
                    </div>
                  ) : (
                    <div
                      className={`w-8 h-8 border-2 ${TYPE_COLORS[annotation.type]} flex items-center justify-center text-white font-bold text-sm shadow-lg cursor-pointer hover:scale-110 transition-transform`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditAnnotation(annotation.id);
                      }}
                    >
                      {annotation.label_number}
                    </div>
                  )}
                </div>
              ))}
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
                    className="p-4 bg-white border border-gray-200 rounded-lg"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-6 h-6 ${annotation.shape === 'circle' ? 'rounded-full' : ''} ${TYPE_COLORS[annotation.type]} flex items-center justify-center text-white font-bold text-xs`}
                        >
                          {annotation.label_number}
                        </span>
                        <span className="text-sm font-medium capitalize text-gray-700">
                          {annotation.type}
                        </span>
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
