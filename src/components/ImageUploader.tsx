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
        "border-2 border-dashed rounded-lg transition-all cursor-pointer hover:border-primary/50 hover:bg-accent/50 bg-background",
        isProcessing && "opacity-50 cursor-not-allowed"
      )}
      onClick={handleClick}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      <div className="flex flex-col items-center justify-center p-8 sm:p-10 md:p-12">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
          disabled={isProcessing}
        />

        <div className="flex flex-col items-center gap-3 sm:gap-4 text-center">
          <div className="rounded-full bg-primary/10 p-3 sm:p-4">
            <Upload className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
          </div>
          <div>
            <p className="text-base sm:text-lg font-semibold">
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
