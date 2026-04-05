'use client';

/**
 * V3.3A.10: Floating Activity Panel
 * 
 * Draggable, resizable, minimizable floating panel for PPAP activity feed.
 * 
 * Features:
 * - Floating panel (default top-right)
 * - Draggable from header
 * - Resizable from bottom-right corner
 * - Minimize to small pill
 * - Restore to previous size/position
 * - Persist state in localStorage
 */

import { useState, useEffect, useRef } from 'react';
import PPAPActivityFeed from './PPAPActivityFeed';
import { getIssueCount } from '../utils/activityService';

interface PPAPActivityPanelProps {
  ppapId: string;
}

interface PanelState {
  position: { x: number; y: number };
  size: { width: number; height: number };
  minimized: boolean;
}

const DEFAULT_STATE: PanelState = {
  position: { x: window.innerWidth - 420, y: 80 }, // Top-right
  size: { width: 400, height: 600 },
  minimized: false,
};

const MIN_WIDTH = 300;
const MIN_HEIGHT = 250;
const STORAGE_KEY = 'ppap_activity_panel_state';

export function PPAPActivityPanel({ ppapId }: PPAPActivityPanelProps) {
  const [state, setState] = useState<PanelState>(DEFAULT_STATE);
  const [issueCount, setIssueCount] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const panelRef = useRef<HTMLDivElement>(null);

  // Load state from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setState({
          position: parsed.position || DEFAULT_STATE.position,
          size: parsed.size || DEFAULT_STATE.size,
          minimized: parsed.minimized ?? DEFAULT_STATE.minimized,
        });
      } catch (error) {
        console.warn('Failed to parse saved panel state:', error);
      }
    }
  }, []);

  // Save state to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  // Load issue count
  useEffect(() => {
    loadIssueCount();
  }, [ppapId]);

  const loadIssueCount = async () => {
    try {
      const count = await getIssueCount(ppapId);
      setIssueCount(count);
    } catch (error) {
      console.error('Failed to load issue count:', error);
    }
  };

  // Drag handlers
  const handleMouseDownDrag = (e: React.MouseEvent) => {
    if (state.minimized) return;
    
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - state.position.x,
      y: e.clientY - state.position.y,
    });
  };

  const handleMouseMoveDrag = (e: MouseEvent) => {
    if (!isDragging) return;

    const newX = Math.max(0, Math.min(e.clientX - dragOffset.x, window.innerWidth - state.size.width));
    const newY = Math.max(0, Math.min(e.clientY - dragOffset.y, window.innerHeight - 100));

    setState(prev => ({
      ...prev,
      position: { x: newX, y: newY },
    }));
  };

  const handleMouseUpDrag = () => {
    setIsDragging(false);
  };

  // Resize handlers
  const handleMouseDownResize = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsResizing(true);
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: state.size.width,
      height: state.size.height,
    });
  };

  const handleMouseMoveResize = (e: MouseEvent) => {
    if (!isResizing) return;

    const deltaX = e.clientX - resizeStart.x;
    const deltaY = e.clientY - resizeStart.y;

    const newWidth = Math.max(MIN_WIDTH, resizeStart.width + deltaX);
    const newHeight = Math.max(MIN_HEIGHT, resizeStart.height + deltaY);

    setState(prev => ({
      ...prev,
      size: { width: newWidth, height: newHeight },
    }));
  };

  const handleMouseUpResize = () => {
    setIsResizing(false);
  };

  // Global mouse event listeners
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMoveDrag);
      window.addEventListener('mouseup', handleMouseUpDrag);
      return () => {
        window.removeEventListener('mousemove', handleMouseMoveDrag);
        window.removeEventListener('mouseup', handleMouseUpDrag);
      };
    }
  }, [isDragging, dragOffset]);

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMoveResize);
      window.addEventListener('mouseup', handleMouseUpResize);
      return () => {
        window.removeEventListener('mousemove', handleMouseMoveResize);
        window.removeEventListener('mouseup', handleMouseUpResize);
      };
    }
  }, [isResizing, resizeStart]);

  // Toggle minimize
  const toggleMinimize = () => {
    setState(prev => ({
      ...prev,
      minimized: !prev.minimized,
    }));
  };

  // MINIMIZED STATE: Small pill
  if (state.minimized) {
    return (
      <div
        ref={panelRef}
        style={{
          position: 'fixed',
          top: `${state.position.y}px`,
          left: `${state.position.x}px`,
          zIndex: 9999,
        }}
        className="bg-blue-600 text-white px-4 py-2 rounded-full shadow-lg cursor-pointer hover:bg-blue-700 transition-colors flex items-center gap-2"
        onClick={toggleMinimize}
      >
        <span className="text-sm font-semibold">Activity</span>
        {issueCount > 0 && (
          <span className="px-2 py-0.5 bg-yellow-400 text-yellow-900 text-xs font-bold rounded-full">
            ⚠️ {issueCount}
          </span>
        )}
      </div>
    );
  }

  // EXPANDED STATE: Full floating panel
  return (
    <div
      ref={panelRef}
      style={{
        position: 'fixed',
        top: `${state.position.y}px`,
        left: `${state.position.x}px`,
        width: `${state.size.width}px`,
        height: `${state.size.height}px`,
        zIndex: 9999,
      }}
      className="bg-white rounded-lg shadow-2xl border-2 border-gray-300 flex flex-col overflow-hidden"
    >
      {/* Header - Draggable */}
      <div
        onMouseDown={handleMouseDownDrag}
        className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-3 cursor-move flex items-center justify-between select-none"
      >
        <div className="flex items-center gap-2">
          <span className="text-base font-bold">Activity</span>
          {issueCount > 0 && (
            <span className="px-2 py-0.5 bg-yellow-400 text-yellow-900 text-xs font-bold rounded-full">
              ⚠️ {issueCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleMinimize}
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-blue-800 transition-colors"
            title="Minimize"
          >
            <span className="text-lg leading-none">−</span>
          </button>
        </div>
      </div>

      {/* Content - Scrollable */}
      <div className="flex-1 overflow-auto p-4">
        <PPAPActivityFeed ppapId={ppapId} />
      </div>

      {/* Resize Handle - Bottom-right corner */}
      <div
        onMouseDown={handleMouseDownResize}
        className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize"
        style={{
          background: 'linear-gradient(135deg, transparent 50%, #9CA3AF 50%)',
        }}
        title="Resize"
      />
    </div>
  );
}
