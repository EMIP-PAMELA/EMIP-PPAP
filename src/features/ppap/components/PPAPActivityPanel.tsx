'use client';

/**
 * V3.3A.10: Floating Activity Panel
 * V3.3A.11: Activity Signal System
 * V3.3A.15: Resize Handle UX Improvement
 * 
 * Draggable, resizable, minimizable floating panel for PPAP activity feed.
 * 
 * Features:
 * - Floating panel (default top-right)
 * - Draggable from header
 * - Resizable from bottom-left corner (V3.3A.15: moved for better UX)
 * - Minimize to small pill
 * - Restore to previous size/position
 * - Persist state in localStorage
 * - Visual signals: unread (blue), issue (yellow), risk (red)
 */

import { useState, useEffect, useRef } from 'react';
import PPAPActivityFeed from './PPAPActivityFeed';
import { getActivities, getIssueCount } from '../utils/activityService';
import { Activity } from '../types/activity';

interface PPAPActivityPanelProps {
  ppapId: string;
}

interface PanelState {
  position: { x: number; y: number };
  size: { width: number; height: number };
  minimized: boolean;
}

// V3.3A.13: Smart default docking - smaller, less intrusive
const getDefaultState = (): PanelState => {
  const width = 380;
  const height = 420;
  const x = Math.max(20, Math.min(window.innerWidth - width - 20, window.innerWidth - 420));
  const y = 100;
  
  return {
    position: { x, y },
    size: { width, height },
    minimized: false,
  };
};

const DEFAULT_STATE: PanelState = getDefaultState();

const MIN_WIDTH = 300;
const MIN_HEIGHT = 250;
const STORAGE_KEY = 'ppap_activity_panel_state';
const LAST_VIEWED_KEY = 'ppap_activity_last_viewed';

type SignalState = 'default' | 'unread' | 'issue' | 'risk';

export function PPAPActivityPanel({ ppapId }: PPAPActivityPanelProps) {
  const [state, setState] = useState<PanelState>(DEFAULT_STATE);
  const [issueCount, setIssueCount] = useState(0);
  const [riskCount, setRiskCount] = useState(0);
  const [signalState, setSignalState] = useState<SignalState>('default');
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
        // V3.3A.13: Clamp saved position to viewport
        const clampedX = Math.max(0, Math.min(parsed.position?.x || DEFAULT_STATE.position.x, window.innerWidth - (parsed.size?.width || DEFAULT_STATE.size.width)));
        const clampedY = Math.max(80, parsed.position?.y || DEFAULT_STATE.position.y);
        
        setState({
          position: { x: clampedX, y: clampedY },
          size: parsed.size || DEFAULT_STATE.size,
          minimized: parsed.minimized ?? DEFAULT_STATE.minimized,
        });
      } catch (error) {
        console.warn('Failed to parse saved panel state:', error);
        setState(getDefaultState());
      }
    } else {
      // V3.3A.13: Apply smart defaults on first load
      setState(getDefaultState());
    }
  }, []);

  // Save state to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  // Load activities and determine signal state
  useEffect(() => {
    loadActivitySignals();
    const interval = setInterval(loadActivitySignals, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [ppapId]);

  const loadActivitySignals = async () => {
    try {
      const activities = await getActivities(ppapId);
      
      // Count issues and risks
      const issues = activities.filter(a => a.priority === 'issue').length;
      const risks = activities.filter(a => a.priority === 'risk').length;
      setIssueCount(issues);
      setRiskCount(risks);
      
      // Determine signal state (priority: risk > issue > unread > default)
      if (risks > 0) {
        setSignalState('risk');
      } else if (issues > 0) {
        setSignalState('issue');
      } else {
        // Check for unread activity
        const lastViewed = localStorage.getItem(`${LAST_VIEWED_KEY}_${ppapId}`);
        if (lastViewed && activities.length > 0) {
          const lastViewedTime = new Date(lastViewed).getTime();
          const latestActivityTime = new Date(activities[0].createdAt).getTime();
          if (latestActivityTime > lastViewedTime) {
            setSignalState('unread');
          } else {
            setSignalState('default');
          }
        } else if (activities.length > 0 && !lastViewed) {
          setSignalState('unread');
        } else {
          setSignalState('default');
        }
      }
    } catch (error) {
      console.error('Failed to load activity signals:', error);
    }
  };

  // Mark as viewed when panel is opened (expanded)
  const markAsViewed = () => {
    const now = new Date().toISOString();
    localStorage.setItem(`${LAST_VIEWED_KEY}_${ppapId}`, now);
    // Only clear unread state, not issue/risk states
    if (signalState === 'unread') {
      setSignalState('default');
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

    // V3.3A.15: Bottom-left resize - width increases when dragging LEFT, height when dragging DOWN
    const deltaX = resizeStart.x - e.clientX; // Inverted for left-side resize
    const deltaY = e.clientY - resizeStart.y;

    const newWidth = Math.max(MIN_WIDTH, resizeStart.width + deltaX);
    const newHeight = Math.max(MIN_HEIGHT, resizeStart.height + deltaY);

    // Adjust position to keep right edge fixed when resizing from left
    const newX = state.position.x - (newWidth - state.size.width);

    setState(prev => ({
      ...prev,
      position: { ...prev.position, x: newX },
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
    const willExpand = state.minimized;
    setState(prev => ({
      ...prev,
      minimized: !prev.minimized,
    }));
    // Mark as viewed when expanding
    if (willExpand) {
      markAsViewed();
    }
  };

  // Get visual styles based on signal state
  const getSignalStyles = () => {
    switch (signalState) {
      case 'risk':
        return {
          border: 'border-red-500',
          shadow: 'shadow-2xl shadow-red-200',
          animation: 'animate-pulse',
          glow: 'ring-2 ring-red-300',
        };
      case 'issue':
        return {
          border: 'border-yellow-400',
          shadow: 'shadow-2xl shadow-yellow-100',
          animation: '',
          glow: 'ring-1 ring-yellow-200',
        };
      case 'unread':
        return {
          border: 'border-blue-400',
          shadow: 'shadow-2xl shadow-blue-100',
          animation: '',
          glow: 'ring-1 ring-blue-200',
        };
      default:
        return {
          border: 'border-gray-300',
          shadow: 'shadow-2xl',
          animation: '',
          glow: '',
        };
    }
  };

  const styles = getSignalStyles();

  // MINIMIZED STATE: Small pill with signal color
  if (state.minimized) {
    const pillBg = signalState === 'risk' ? 'bg-red-600 hover:bg-red-700' :
                   signalState === 'issue' ? 'bg-yellow-500 hover:bg-yellow-600' :
                   signalState === 'unread' ? 'bg-blue-600 hover:bg-blue-700' :
                   'bg-gray-600 hover:bg-gray-700';
    
    const pillBorder = signalState === 'risk' ? 'border-2 border-red-400' :
                       signalState === 'issue' ? 'border-2 border-yellow-300' :
                       signalState === 'unread' ? 'border-2 border-blue-400' :
                       'border border-gray-400';
    
    const pillAnimation = signalState === 'risk' ? 'animate-pulse' : '';
    
    return (
      <div
        ref={panelRef}
        style={{
          position: 'fixed',
          top: `${state.position.y}px`,
          left: `${state.position.x}px`,
          zIndex: 9999,
        }}
        className={`${pillBg} ${pillBorder} ${pillAnimation} text-white px-4 py-2 rounded-full shadow-lg cursor-pointer transition-colors flex items-center gap-2`}
        onClick={toggleMinimize}
      >
        <span className="text-sm font-semibold">Activity</span>
        {(issueCount > 0 || riskCount > 0) && (
          <span className="px-2 py-0.5 bg-white bg-opacity-90 text-gray-900 text-xs font-bold rounded-full">
            {riskCount > 0 ? '🚨' : '⚠️'} {issueCount + riskCount}
          </span>
        )}
      </div>
    );
  }

  // EXPANDED STATE: Full floating panel with signal styling
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
      className={`bg-white rounded-lg ${styles.shadow} border-2 ${styles.border} ${styles.glow} ${styles.animation} flex flex-col overflow-hidden`}
    >
      {/* Header - Draggable with signal-based color */}
      <div
        onMouseDown={handleMouseDownDrag}
        className={`${
          signalState === 'risk' ? 'bg-gradient-to-r from-red-600 to-red-700' :
          signalState === 'issue' ? 'bg-gradient-to-r from-yellow-500 to-yellow-600' :
          signalState === 'unread' ? 'bg-gradient-to-r from-blue-600 to-blue-700' :
          'bg-gradient-to-r from-gray-600 to-gray-700'
        } text-white px-4 py-3 cursor-move flex items-center justify-between select-none`}
      >
        <div className="flex items-center gap-2">
          <span className="text-base font-bold">Activity</span>
          {(issueCount > 0 || riskCount > 0) && (
            <span className="px-2 py-0.5 bg-white bg-opacity-90 text-gray-900 text-xs font-bold rounded-full">
              {riskCount > 0 ? '🚨' : '⚠️'} {issueCount + riskCount}
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

      {/* V3.3A.15: Resize Handle - Bottom-left corner for better UX when docked */}
      <div
        onMouseDown={handleMouseDownResize}
        className="absolute bottom-0 left-0 w-5 h-5 cursor-sw-resize flex items-end justify-start p-1"
        title="Resize"
      >
        <div className="w-3 h-3 border-l-2 border-b-2 border-gray-400 opacity-60" />
      </div>
    </div>
  );
}
