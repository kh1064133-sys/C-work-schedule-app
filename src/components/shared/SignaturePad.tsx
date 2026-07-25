'use client';

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';

export type SignaturePadHandle = {
  clear: () => void;
  getDataUrl: () => string;
  hasSignature: () => boolean;
};

type SignaturePadProps = {
  initialDataUrl?: string | null;
  disabled?: boolean;
  height?: number;
  penColor?: string;
  backgroundColor?: string;
  guideText?: string;
  imageAlt?: string;
  onChange?: (hasSignature: boolean) => void;
  style?: React.CSSProperties;
};

export const SignaturePad = forwardRef<SignaturePadHandle, SignaturePadProps>(function SignaturePad(
  {
    initialDataUrl,
    disabled = false,
    height = 140,
    penColor = '#1a237e',
    backgroundColor = '#fafafa',
    guideText = '여기에 서명해 주세요',
    imageAlt = '고객 서명',
    onChange,
    style,
  },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const lastPosRef = useRef({ x: 0, y: 0 });
  const hasSignatureRef = useRef(Boolean(initialDataUrl));
  const [showInitialImage, setShowInitialImage] = useState(Boolean(initialDataUrl));

  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const parent = canvas.parentElement;
    const width = Math.max(1, Math.round(parent?.getBoundingClientRect().width || 320));
    const dpr = window.devicePixelRatio || 1;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(20, height - 30);
    ctx.lineTo(width - 20, height - 30);
    ctx.stroke();
    ctx.fillStyle = '#9ca3af';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(guideText, width / 2, height - 10);
  }, [backgroundColor, guideText, height]);

  useEffect(() => {
    hasSignatureRef.current = Boolean(initialDataUrl);
    setShowInitialImage(Boolean(initialDataUrl));
  }, [initialDataUrl]);

  useEffect(() => {
    if (showInitialImage) return;
    requestAnimationFrame(() => initCanvas());
  }, [initCanvas, showInitialImage]);

  useEffect(() => {
    if (showInitialImage) return;

    const handleResize = () => initCanvas();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [initCanvas, showInitialImage]);

  const getPos = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    const rect = canvas?.getBoundingClientRect();
    return {
      x: clientX - (rect?.left || 0),
      y: clientY - (rect?.top || 0),
    };
  }, []);

  const beginStroke = useCallback((clientX: number, clientY: number) => {
    if (disabled) return;
    if (showInitialImage) {
      setShowInitialImage(false);
      requestAnimationFrame(() => initCanvas());
    }
    isDrawingRef.current = true;
    lastPosRef.current = getPos(clientX, clientY);
    hasSignatureRef.current = true;
    onChange?.(true);
  }, [disabled, getPos, initCanvas, onChange, showInitialImage]);

  const moveStroke = useCallback((clientX: number, clientY: number) => {
    if (disabled || !isDrawingRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;

    const pos = getPos(clientX, clientY);
    ctx.strokeStyle = penColor;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPosRef.current = pos;
  }, [disabled, getPos, penColor]);

  const endStroke = useCallback(() => {
    isDrawingRef.current = false;
  }, []);

  const clear = useCallback(() => {
    setShowInitialImage(false);
    hasSignatureRef.current = false;
    onChange?.(false);
    requestAnimationFrame(() => initCanvas());
  }, [initCanvas, onChange]);

  useImperativeHandle(ref, () => ({
    clear,
    getDataUrl: () => {
      if (showInitialImage && initialDataUrl) return initialDataUrl;
      return canvasRef.current?.toDataURL('image/png') || '';
    },
    hasSignature: () => hasSignatureRef.current,
  }), [clear, initialDataUrl, showInitialImage]);

  return (
    <div
      style={{
        width: '100%',
        overflow: 'hidden',
        background: backgroundColor,
        touchAction: 'none',
        ...style,
      }}
    >
      {showInitialImage && initialDataUrl ? (
        <img
          src={initialDataUrl}
          alt={imageAlt}
          style={{
            display: 'block',
            width: '100%',
            height,
            objectFit: 'contain',
            background: backgroundColor,
          }}
        />
      ) : (
        <canvas
          ref={canvasRef}
          onMouseDown={(event) => {
            event.preventDefault();
            beginStroke(event.clientX, event.clientY);
          }}
          onMouseMove={(event) => {
            event.preventDefault();
            moveStroke(event.clientX, event.clientY);
          }}
          onMouseUp={endStroke}
          onMouseLeave={endStroke}
          onTouchStart={(event) => {
            event.preventDefault();
            const touch = event.touches[0];
            if (touch) beginStroke(touch.clientX, touch.clientY);
          }}
          onTouchMove={(event) => {
            event.preventDefault();
            const touch = event.touches[0];
            if (touch) moveStroke(touch.clientX, touch.clientY);
          }}
          onTouchEnd={(event) => {
            event.preventDefault();
            endStroke();
          }}
          style={{
            display: 'block',
            cursor: disabled ? 'default' : 'crosshair',
            touchAction: 'none',
          }}
        />
      )}
    </div>
  );
});
