import { useEffect, useRef, useState, useCallback } from 'react';
import { GripVertical } from 'lucide-react';

interface ResizableSplitPaneProps {
  topChild: React.ReactNode;
  bottomChild: React.ReactNode;
  storageKey?: string;
  defaultSplit?: number; // Percentage (0-100)
}

export function ResizableSplitPane({
  topChild,
  bottomChild,
  storageKey = 'split-pane-position',
  defaultSplit = 50,
}: ResizableSplitPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [splitPosition, setSplitPosition] = useState(defaultSplit);
  const [isDragging, setIsDragging] = useState(false);

  // Load split position from localStorage on mount, default to 50 if not found
  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      const parsed = parseFloat(saved);
      if (!isNaN(parsed) && parsed >= 10 && parsed <= 90) {
        setSplitPosition(parsed);
      } else {
        // Invalid saved value, reset to default
        setSplitPosition(defaultSplit);
        localStorage.setItem(storageKey, defaultSplit.toString());
      }
    } else {
      // No saved value, use default (50)
      setSplitPosition(defaultSplit);
    }
  }, [storageKey, defaultSplit]);

  // Save split position to localStorage
  useEffect(() => {
    localStorage.setItem(storageKey, splitPosition.toString());
  }, [splitPosition, storageKey]);

  const handleMouseDown = useCallback(() => {
    setIsDragging(true);
  }, []);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return;

      const container = containerRef.current;
      const rect = container.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const percentage = (y / rect.height) * 100;

      // Constrain between 10% and 90%
      const constrained = Math.max(10, Math.min(90, percentage));
      setSplitPosition(constrained);
    },
    [isDragging]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'row-resize';
      document.body.style.userSelect = 'none';

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return (
    <div ref={containerRef} className="flex flex-col h-full relative">
      <div
        className="min-h-0 overflow-hidden"
        style={{ height: `${splitPosition}%` }}
      >
        {topChild}
      </div>
      <div
        className="relative flex items-center justify-center cursor-row-resize hover:bg-accent/50 transition-colors group flex-shrink-0 border-t border-b border-border"
        style={{ height: '4px' }}
        onMouseDown={handleMouseDown}
      >
        <div className="absolute inset-0" />
        <GripVertical className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
      </div>
      <div
        className="min-h-0 overflow-hidden"
        style={{ height: `${100 - splitPosition}%` }}
      >
        {bottomChild}
      </div>
    </div>
  );
}
