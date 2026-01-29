import React, { useRef, useEffect, useState } from 'react';

interface SignaturePadProps {
  onSave: (dataUrl: string) => void;
  width?: number;
  height?: number;
}

const SignaturePad: React.FC<SignaturePadProps> = ({ onSave, width = 400, height = 200 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isSigned, setIsSigned] = useState(false);

  const getCanvasContext = () => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return canvas.getContext('2d');
  };
  
  useEffect(() => {
    const context = getCanvasContext();
    if (context) {
      context.strokeStyle = '#333';
      context.lineWidth = 2;
      context.lineCap = 'round';
      context.lineJoin = 'round';
    }
  }, []);

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    const context = getCanvasContext();
    if (!context) return;

    const { offsetX, offsetY } = getCoords(e);
    context.beginPath();
    context.moveTo(offsetX, offsetY);
    setIsDrawing(true);
    setIsSigned(true);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const context = getCanvasContext();
    if (!context) return;
    
    const { offsetX, offsetY } = getCoords(e);
    context.lineTo(offsetX, offsetY);
    context.stroke();
  };

  const stopDrawing = () => {
    const context = getCanvasContext();
    if (!context) return;
    context.closePath();
    setIsDrawing(false);
  };

  const getCoords = (e: React.MouseEvent | React.TouchEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return { offsetX: 0, offsetY: 0 };
      const rect = canvas.getBoundingClientRect();
      
      if (e.nativeEvent instanceof MouseEvent) {
          return { offsetX: e.nativeEvent.offsetX, offsetY: e.nativeEvent.offsetY };
      }
      if (e.nativeEvent instanceof TouchEvent) {
           return {
            offsetX: e.nativeEvent.touches[0].clientX - rect.left,
            offsetY: e.nativeEvent.touches[0].clientY - rect.top
        };
      }
      return { offsetX: 0, offsetY: 0 };
  };

  const handleClear = () => {
    const context = getCanvasContext();
    if (context && canvasRef.current) {
      context.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      setIsSigned(false);
      // Notify parent that signature is cleared
      if (canvasRef.current) {
        onSave(''); 
      }
    }
  };

  const handleSave = () => {
    if (canvasRef.current && isSigned) {
      const dataUrl = canvasRef.current.toDataURL('image/png');
      onSave(dataUrl);
    }
  };

  return (
    <div className="w-full">
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={stopDrawing}
        className="bg-white border border-slate-300 dark:border-slate-600 rounded-md w-full"
        role="img"
        aria-label="لوحة التوقيع, ارسم توقيعك هنا"
      />
      <div className="flex justify-center gap-4 mt-2">
        <button onClick={handleClear} className="text-sm font-semibold text-slate-600 hover:text-slate-800 dark:text-slate-300 dark:hover:text-white">
          مسح
        </button>
        <button onClick={handleSave} disabled={!isSigned} className="text-sm font-semibold text-blue-600 hover:text-blue-800 disabled:text-slate-400 disabled:cursor-not-allowed">
          اعتماد هذا التوقيع
        </button>
      </div>
    </div>
  );
};

export default SignaturePad;
