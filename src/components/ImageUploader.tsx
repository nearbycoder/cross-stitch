import { useRef } from 'react';
import { usePatternStore } from '../store/patternStore';
import { Upload } from 'lucide-react';
import { cn } from '../lib/utils';

export function ImageUploader() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { loadImage, isProcessing } = usePatternStore();

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      await loadImage(file);
    }
  };

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();

    const file = event.dataTransfer.files?.[0];
    if (file) {
      await loadImage(file);
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-dashed border-border/70 bg-card/70 transition-all cursor-pointer hover:border-primary/50 hover:bg-card shadow-sm hover:shadow-md",
        isProcessing && "opacity-50 cursor-not-allowed"
      )}
      onClick={handleClick}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,137,105,0.15),transparent_60%)] opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="relative flex flex-col items-center justify-center p-8 sm:p-10 md:p-12">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
          disabled={isProcessing}
        />

        <div className="flex flex-col items-center gap-3 sm:gap-4 text-center">
          <div className="rounded-2xl bg-primary/15 p-3 sm:p-4 ring-1 ring-primary/20">
            <Upload className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
          </div>
          <div>
            <p className="text-base sm:text-lg font-semibold font-display">
              {isProcessing ? 'Loading...' : 'Click or drag an image to upload'}
            </p>
            <p className="text-xs sm:text-sm text-muted-foreground mt-2">
              JPG, PNG, GIF, or WebP (max 10MB)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
