'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Trash2, Download, Upload, MousePointer2, Square, Minus,
  Type, Circle, ArrowRight, Undo2, Redo2, Palette, Copy,
  ClipboardPaste, Move, Pencil, MessageSquare, Tag,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

/* ─── Types ─── */
export interface DiagramData {
  fabricJSON?: unknown;
  canvasWidth: number;
  canvasHeight: number;
  objects?: unknown[]; // backward compat
}

type Tool = 'select' | 'rect' | 'line' | 'arrow' | 'ellipse' | 'text' | 'freehand' | 'pan' | 'callout' | 'labelCallout';

const COLORS = ['#000000', '#ef4444', '#3b82f6', '#22c55e', '#a855f7', '#f97316', '#06b6d4', '#ffffff'];
const STROKE_WIDTHS = [1, 2, 3, 4, 6];
const CANVAS_W = 1200;
const CANVAS_H = 800;

/* ─── 범례 프리셋 ─── */
interface LegendItem {
  label: string;
  drawType: 'line' | 'rect';
  stroke: string;
  fill: string;
  strokeWidth: number;
}

const LEGEND_ITEMS: LegendItem[] = [
  { label: '광케이블 4C', drawType: 'line', stroke: '#ef4444', fill: 'transparent', strokeWidth: 3 },
  { label: '광점퍼케이블', drawType: 'line', stroke: '#a855f7', fill: 'transparent', strokeWidth: 3 },
  { label: 'UTP케이블', drawType: 'line', stroke: '#06b6d4', fill: 'transparent', strokeWidth: 3 },
  { label: '통신랙', drawType: 'rect', stroke: '#16a34a', fill: '#22c55e', strokeWidth: 2 },
  { label: 'L2스위치', drawType: 'rect', stroke: '#dc2626', fill: '#ef4444', strokeWidth: 2 },
];

/* ─── 말풍선 프리셋 ─── */
type CalloutTailPos = 'bottomLeft' | 'bottomCenter' | 'bottomRight' | 'leftCenter';

interface CalloutPreset {
  id: CalloutTailPos;
  label: string;
}

const CALLOUT_PRESETS: CalloutPreset[] = [
  { id: 'bottomLeft', label: '좌하' },
  { id: 'bottomCenter', label: '중하' },
  { id: 'bottomRight', label: '우하' },
  { id: 'leftCenter', label: '좌측' },
];

/* ─── Fabric.js dynamic import (SSR safe) ─── */
let fabricModule: typeof import('fabric') | null = null;
async function loadFabric() {
  if (fabricModule) return fabricModule;
  fabricModule = await import('fabric');
  return fabricModule;
}

export function DiagramSheet({ value, onChange }: { value?: DiagramData; onChange: (d: DiagramData) => void }) {
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const fcRef = useRef<import('fabric').Canvas | null>(null);
  const [ready, setReady] = useState(false);
  const [tool, setTool] = useState<Tool>('select');
  const [stroke, setStroke] = useState('#000000');
  const [fill, setFill] = useState('transparent');
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [fontSize, setFontSize] = useState(16);
  const [activeLegend, setActiveLegend] = useState<string | null>(null);
  const [calloutStyle, setCalloutStyle] = useState<CalloutTailPos>('bottomLeft');
  const calloutStyleRef = useRef<CalloutTailPos>('bottomLeft');
  useEffect(() => { calloutStyleRef.current = calloutStyle; }, [calloutStyle]);
  const [zoom, setZoom] = useState(1);
  const [clipboard, setClipboard] = useState<import('fabric').FabricObject | null>(null);
  const clipboardRef = useRef<import('fabric').FabricObject | null>(null);

  // History (undo/redo)
  const historyRef = useRef<string[]>([]);
  const historyIdxRef = useRef(-1);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [historyLen, setHistoryLen] = useState(0);
  const skipHistoryRef = useRef(false);

  // Drawing state refs (avoid stale closures)
  const toolRef = useRef<Tool>(tool);
  const strokeRef = useRef(stroke);
  const fillRef = useRef(fill);
  const strokeWidthRef = useRef(strokeWidth);
  const fontSizeRef = useRef(fontSize);
  const drawingLineRef = useRef<import('fabric').FabricObject | null>(null);
  const drawStartRef = useRef<{ x: number; y: number } | null>(null);
  const isDrawingRef = useRef(false);
  const freehandPathRef = useRef<{ x: number; y: number }[]>([]);
  const isPanningRef = useRef(false);
  const panLastRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => { toolRef.current = tool; }, [tool]);
  useEffect(() => { strokeRef.current = stroke; }, [stroke]);
  useEffect(() => { fillRef.current = fill; }, [fill]);
  useEffect(() => { strokeWidthRef.current = strokeWidth; }, [strokeWidth]);
  useEffect(() => { fontSizeRef.current = fontSize; }, [fontSize]);

  // Refs for functions used in init useEffect (avoid stale closures)
  const saveToParentRef = useRef<() => void>(() => {});
  const pushHistoryRef = useRef<() => void>(() => {});
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ─── Save / History ─── */
  const saveToParent = useCallback(() => {
    const fc = fcRef.current;
    if (!fc) return;
    // 디바운스: 빠른 연속 저장 방지 (캔버스 상태 충돌 예방)
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const fc2 = fcRef.current;
      if (!fc2) return;
      const json = fc2.toJSON();
      onChangeRef.current({ fabricJSON: json, canvasWidth: CANVAS_W, canvasHeight: CANVAS_H });
    }, 100);
  }, []);
  saveToParentRef.current = saveToParent;

  const pushHistory = useCallback(() => {
    const fc = fcRef.current;
    if (!fc || skipHistoryRef.current) return;
    const json = JSON.stringify(fc.toJSON());
    const arr = historyRef.current;
    // trim future
    historyRef.current = arr.slice(0, historyIdxRef.current + 1);
    historyRef.current.push(json);
    historyIdxRef.current = historyRef.current.length - 1;
    setHistoryIdx(historyIdxRef.current);
    setHistoryLen(historyRef.current.length);
  }, []);
  pushHistoryRef.current = pushHistory;

  const restoreHistory = useCallback(async (idx: number) => {
    const fc = fcRef.current;
    if (!fc) return;
    const json = historyRef.current[idx];
    if (!json) return;
    skipHistoryRef.current = true;
    await fc.loadFromJSON(json);
    fc.renderAll();
    skipHistoryRef.current = false;
    historyIdxRef.current = idx;
    setHistoryIdx(idx);
    saveToParentRef.current();
  }, []);

  const undo = useCallback(() => {
    if (historyIdxRef.current <= 0) return;
    restoreHistory(historyIdxRef.current - 1);
  }, [restoreHistory]);

  const redo = useCallback(() => {
    if (historyIdxRef.current >= historyRef.current.length - 1) return;
    restoreHistory(historyIdxRef.current + 1);
  }, [restoreHistory]);

  /* ─── Init Fabric Canvas ─── */
  useEffect(() => {
    let disposed = false;
    (async () => {
      const fabric = await loadFabric();
      if (disposed || !canvasElRef.current) return;

      const fc = new fabric.Canvas(canvasElRef.current, {
        width: CANVAS_W,
        height: CANVAS_H,
        backgroundColor: '#ffffff',
        selection: true,
        preserveObjectStacking: true,
      });
      fcRef.current = fc;

      // Grid
      for (let x = 0; x <= CANVAS_W; x += 50) {
        fc.add(new fabric.Line([x, 0, x, CANVAS_H], {
          stroke: '#f0f0f0', strokeWidth: 1, selectable: false, evented: false, excludeFromExport: false,
        }));
      }
      for (let y = 0; y <= CANVAS_H; y += 50) {
        fc.add(new fabric.Line([0, y, CANVAS_W, y], {
          stroke: '#f0f0f0', strokeWidth: 1, selectable: false, evented: false, excludeFromExport: false,
        }));
      }

      // Load saved data
      if (value?.fabricJSON) {
        skipHistoryRef.current = true;
        await fc.loadFromJSON(value.fabricJSON as string);
        fc.renderAll();
        skipHistoryRef.current = false;
      }

      // Save initial history
      pushHistoryRef.current();

      /* ─── Mouse events ─── */
      fc.on('mouse:down', (opt) => {
        const t = toolRef.current;
        const e = opt.e as MouseEvent;
        const pointer = fc.getScenePoint(e);

        if (t === 'pan') {
          isPanningRef.current = true;
          panLastRef.current = { x: e.clientX, y: e.clientY };
          fc.selection = false;
          return;
        }

        if (t === 'select') return;

        isDrawingRef.current = true;
        fc.selection = false;
        drawStartRef.current = { x: pointer.x, y: pointer.y };

        if (t === 'text') {
          const text = new fabric.IText('텍스트', {
            left: pointer.x,
            top: pointer.y,
            fontSize: fontSizeRef.current,
            fill: strokeRef.current,
            fontFamily: 'sans-serif',
          });
          fc.add(text);
          fc.setActiveObject(text);
          text.enterEditing();
          isDrawingRef.current = false;
          fc.selection = true;
          pushHistoryRef.current();
          saveToParentRef.current();
          return;
        }

        if (t === 'freehand') {
          freehandPathRef.current = [{ x: pointer.x, y: pointer.y }];
          return;
        }

        // Create preview shape
        let shape: import('fabric').FabricObject | null = null;
        if (t === 'rect') {
          shape = new fabric.Rect({
            left: pointer.x, top: pointer.y, width: 0, height: 0,
            stroke: strokeRef.current, strokeWidth: strokeWidthRef.current,
            fill: fillRef.current === 'transparent' ? '' : fillRef.current,
            strokeUniform: true,
          });
        } else if (t === 'ellipse') {
          shape = new fabric.Ellipse({
            left: pointer.x, top: pointer.y, rx: 0, ry: 0,
            stroke: strokeRef.current, strokeWidth: strokeWidthRef.current,
            fill: fillRef.current === 'transparent' ? '' : fillRef.current,
            strokeUniform: true,
          });
        } else if (t === 'line') {
          shape = new fabric.Line([pointer.x, pointer.y, pointer.x, pointer.y], {
            stroke: strokeRef.current, strokeWidth: strokeWidthRef.current,
            strokeUniform: true,
          });
        } else if (t === 'arrow') {
          // arrow: line + triangle
          shape = new fabric.Line([pointer.x, pointer.y, pointer.x, pointer.y], {
            stroke: strokeRef.current, strokeWidth: strokeWidthRef.current,
            strokeUniform: true,
          });
        } else if (t === 'callout') {
          shape = new fabric.Rect({
            left: pointer.x, top: pointer.y, width: 0, height: 0,
            stroke: strokeRef.current, strokeWidth: strokeWidthRef.current,
            fill: fillRef.current === 'transparent' ? '#ffffff' : fillRef.current,
            rx: 6, ry: 6, strokeUniform: true,
          });
        } else if (t === 'labelCallout') {
          shape = new fabric.Rect({
            left: pointer.x, top: pointer.y, width: 0, height: 0,
            stroke: strokeRef.current, strokeWidth: strokeWidthRef.current,
            fill: fillRef.current === 'transparent' ? '#ffffff' : fillRef.current,
            strokeUniform: true,
          });
        }

        if (shape) {
          fc.add(shape);
          drawingLineRef.current = shape;
        }
      });

      fc.on('mouse:move', (opt) => {
        const e = opt.e as MouseEvent;

        if (isPanningRef.current && panLastRef.current) {
          const vpt = fc.viewportTransform!;
          vpt[4] += e.clientX - panLastRef.current.x;
          vpt[5] += e.clientY - panLastRef.current.y;
          panLastRef.current = { x: e.clientX, y: e.clientY };
          fc.requestRenderAll();
          return;
        }

        if (!isDrawingRef.current || !drawStartRef.current) return;
        const pointer = fc.getScenePoint(e);
        const t = toolRef.current;

        if (t === 'freehand') {
          freehandPathRef.current.push({ x: pointer.x, y: pointer.y });
          // Live preview: draw temporary line segments
          return;
        }

        const shape = drawingLineRef.current;
        if (!shape) return;

        const sx = drawStartRef.current.x;
        const sy = drawStartRef.current.y;

        if (t === 'rect' || t === 'callout' || t === 'labelCallout') {
          const r = shape as import('fabric').Rect;
          const left = Math.min(sx, pointer.x);
          const top = Math.min(sy, pointer.y);
          r.set({ left, top, width: Math.abs(pointer.x - sx), height: Math.abs(pointer.y - sy) });
        } else if (t === 'ellipse') {
          const el = shape as import('fabric').Ellipse;
          const left = Math.min(sx, pointer.x);
          const top = Math.min(sy, pointer.y);
          el.set({ left, top, rx: Math.abs(pointer.x - sx) / 2, ry: Math.abs(pointer.y - sy) / 2 });
        } else if (t === 'line' || t === 'arrow') {
          const ln = shape as import('fabric').Line;
          ln.set({ x2: pointer.x, y2: pointer.y });
        }
        fc.renderAll();
      });

      fc.on('mouse:up', () => {
        if (isPanningRef.current) {
          isPanningRef.current = false;
          panLastRef.current = null;
          fc.selection = toolRef.current === 'select';
          return;
        }

        if (!isDrawingRef.current) return;
        isDrawingRef.current = false;
        fc.selection = true;
        const t = toolRef.current;

        if (t === 'freehand') {
          const pts = freehandPathRef.current;
          if (pts.length >= 2) {
            const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
            const path = new fabric.Path(pathD, {
              stroke: strokeRef.current,
              strokeWidth: strokeWidthRef.current,
              fill: '',
              strokeLineCap: 'round',
              strokeLineJoin: 'round',
            });
            fc.add(path);
          }
          freehandPathRef.current = [];
          pushHistoryRef.current();
          saveToParentRef.current();
          return;
        }

        // Check if the drawn shape is too small (skip)
        const shape = drawingLineRef.current;
        if (shape) {
          if (t === 'rect' || t === 'ellipse' || t === 'callout' || t === 'labelCallout') {
            const w = (shape as any).width ?? ((shape as any).rx * 2 || 0);
            const h = (shape as any).height ?? ((shape as any).ry * 2 || 0);
            if (w < 3 && h < 3) {
              fc.remove(shape);
              drawingLineRef.current = null;
              drawStartRef.current = null;
              return;
            }
          }

          // 첨부말풍선: rect + 하단 중앙 리더 라인 + 텍스트
          if (t === 'labelCallout') {
            const r = shape as import('fabric').Rect;
            const rLeft = r.left!, rTop = r.top!;
            const rW = r.width!, rH = r.height!;
            fc.remove(shape);

            const body = new fabric.Rect({
              left: 0, top: 0, width: rW, height: rH,
              fill: r.fill as string || '#ffffff',
              stroke: r.stroke as string, strokeWidth: r.strokeWidth,
              strokeUniform: true,
            });
            const tailLen = Math.max(30, rH * 0.6);
            const tail = new fabric.Line(
              [rW / 2, rH, rW / 2, rH + tailLen],
              {
                stroke: r.stroke as string, strokeWidth: r.strokeWidth,
                strokeUniform: true,
              }
            );
            const label = new fabric.IText('텍스트', {
              left: rW / 2, top: rH / 2,
              fontSize: fontSizeRef.current,
              fill: r.stroke as string || '#000000',
              fontFamily: 'sans-serif',
              originX: 'center', originY: 'center',
            });
            const group = new fabric.Group([body, tail, label], {
              left: rLeft, top: rTop,
              subTargetCheck: true,
              interactive: true,
            });
            fc.add(group);
            fc.setActiveObject(group);
            drawingLineRef.current = null;
            drawStartRef.current = null;
            pushHistoryRef.current();
            saveToParentRef.current();
            return;
          }

          // Callout: replace preview rect with group (rounded rect + tail)
          if (t === 'callout') {
            const r = shape as import('fabric').Rect;
            const rLeft = r.left!, rTop = r.top!;
            const rW = r.width!, rH = r.height!;
            fc.remove(shape);

            const body = new fabric.Rect({
              left: 0, top: 0, width: rW, height: rH,
              rx: 6, ry: 6,
              fill: r.fill as string || '#ffffff',
              stroke: r.stroke as string, strokeWidth: r.strokeWidth,
              strokeUniform: true,
            });

            const cs = calloutStyleRef.current;
            let tailPoints: { x: number; y: number }[];
            const tailLen = Math.max(20, Math.min(rW, rH) * 0.4);

            if (cs === 'bottomLeft') {
              const tx = rW * 0.25;
              tailPoints = [
                { x: tx - 6, y: rH },
                { x: tx - tailLen * 0.3, y: rH + tailLen },
                { x: tx + 6, y: rH },
              ];
            } else if (cs === 'bottomCenter') {
              const tx = rW / 2;
              tailPoints = [
                { x: tx - 8, y: rH },
                { x: tx, y: rH + tailLen },
                { x: tx + 8, y: rH },
              ];
            } else if (cs === 'bottomRight') {
              const tx = rW * 0.75;
              tailPoints = [
                { x: tx - 6, y: rH },
                { x: tx + tailLen * 0.3, y: rH + tailLen },
                { x: tx + 6, y: rH },
              ];
            } else {
              // leftCenter
              const ty = rH / 2;
              tailPoints = [
                { x: 0, y: ty - 6 },
                { x: -tailLen, y: ty + tailLen * 0.3 },
                { x: 0, y: ty + 6 },
              ];
            }

            const tail = new fabric.Polygon(tailPoints, {
              fill: r.fill as string || '#ffffff',
              stroke: r.stroke as string, strokeWidth: r.strokeWidth,
              strokeUniform: true,
            });
            const group = new fabric.Group([body, tail], {
              left: rLeft, top: rTop,
            });
            fc.add(group);
            drawingLineRef.current = null;
            drawStartRef.current = null;
            pushHistoryRef.current();
            saveToParentRef.current();
            return;
          }

          // For arrow: add arrowhead triangle
          if (t === 'arrow') {
            const ln = shape as import('fabric').Line;
            const x1 = ln.x1!, y1 = ln.y1!, x2 = ln.x2!, y2 = ln.y2!;
            const dx = x2 - x1, dy = y2 - y1;
            const len = Math.sqrt(dx * dx + dy * dy);
            if (len < 3) {
              fc.remove(shape);
              drawingLineRef.current = null;
              drawStartRef.current = null;
              return;
            }
            const headLen = Math.min(16, len / 3);
            const angle = Math.atan2(dy, dx);
            const headAngle = Math.PI / 6;
            const points = [
              { x: x2, y: y2 },
              { x: x2 - headLen * Math.cos(angle - headAngle), y: y2 - headLen * Math.sin(angle - headAngle) },
              { x: x2 - headLen * Math.cos(angle + headAngle), y: y2 - headLen * Math.sin(angle + headAngle) },
            ];
            const triangle = new fabric.Polygon(points, {
              fill: strokeRef.current,
              stroke: strokeRef.current,
              strokeWidth: 1,
              selectable: false,
              evented: false,
            });
            // Group line + arrowhead
            fc.remove(shape);
            const group = new fabric.Group([
              new fabric.Line([x1, y1, x2, y2], {
                stroke: ln.stroke as string,
                strokeWidth: ln.strokeWidth,
                strokeUniform: true,
              }),
              triangle,
            ], {
              left: Math.min(x1, x2) - headLen,
              top: Math.min(y1, y2) - headLen,
            });
            fc.add(group);
          }
          shape.setCoords();
        }
        drawingLineRef.current = null;
        drawStartRef.current = null;
        pushHistoryRef.current();
        saveToParentRef.current();
      });

      // On object modified (move, resize, rotate)
      fc.on('object:modified', () => {
        console.log('[구성도] object:modified — 객체수:', fc.getObjects().length);
        pushHistoryRef.current();
        saveToParentRef.current();
      });

      // 선택 해제 시 디버그
      fc.on('selection:cleared', () => {
        console.log('[구성도] selection:cleared — 객체수:', fc.getObjects().length);
      });

      fc.on('mouse:down', () => {
        console.log('[구성도] mouse:down — tool:', toolRef.current, '객체수:', fc.getObjects().length, 'isDrawing:', isDrawingRef.current);
      });

      fc.on('mouse:up', () => {
        console.log('[구성도] mouse:up — tool:', toolRef.current, '객체수:', fc.getObjects().length, 'isDrawing:', isDrawingRef.current);
      });

      setReady(true);
    })();

    return () => {
      disposed = true;
      fcRef.current?.dispose();
      fcRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ─── Tool change → canvas mode ─── */
  useEffect(() => {
    const fc = fcRef.current;
    if (!fc) return;
    if (tool === 'select') {
      fc.selection = true;
      fc.forEachObject(o => {
        if ((o as any).excludeFromExport === false && o.stroke === '#f0f0f0') return; // grid lines
        o.selectable = true;
        o.evented = true;
      });
      fc.defaultCursor = 'default';
    } else if (tool === 'pan') {
      fc.selection = false;
      fc.forEachObject(o => { o.selectable = false; o.evented = false; });
      fc.defaultCursor = 'grab';
    } else {
      fc.selection = false;
      fc.discardActiveObject();
      fc.forEachObject(o => { o.selectable = false; o.evented = false; });
      fc.defaultCursor = 'crosshair';
      fc.renderAll();
    }
  }, [tool, ready]);

  /* ─── Copy / Paste (ref 기반, stale closure 방지) ─── */
  const copySelectedFn = useCallback(() => {
    const fc = fcRef.current;
    if (!fc) return;
    const active = fc.getActiveObject();
    if (!active) return;
    active.clone().then((cloned: import('fabric').FabricObject) => {
      clipboardRef.current = cloned;
      setClipboard(cloned);
    });
  }, []);
  const copyRef = useRef(copySelectedFn);
  copyRef.current = copySelectedFn;

  const setToolRef = useRef(setTool);
  setToolRef.current = setTool;
  const setActiveLegendRef = useRef(setActiveLegend);
  setActiveLegendRef.current = setActiveLegend;

  const pasteClipboardFn = useCallback(() => {
    const fc = fcRef.current;
    const cb = clipboardRef.current;
    if (!fc || !cb) return;
    cb.clone().then((cloned: import('fabric').FabricObject) => {
      // 붙여넣기 객체 상호작용 가능하게 설정
      cloned.set({
        left: (cloned.left ?? 0) + 20,
        top: (cloned.top ?? 0) + 20,
        selectable: true,
        evented: true,
      });
      fc.add(cloned);

      // select 모드로 전환 (다음 클릭이 그리기모드로 동작하지 않도록)
      setToolRef.current('select');
      setActiveLegendRef.current(null);
      fc.selection = true;
      fc.forEachObject(o => {
        if (o.stroke === '#f0f0f0' && (o as any).excludeFromExport === false) return;
        o.selectable = true;
        o.evented = true;
      });
      fc.defaultCursor = 'default';

      fc.setActiveObject(cloned);
      fc.requestRenderAll();
      pushHistoryRef.current();
      saveToParentRef.current();
      // Shift clipboard for next paste
      cb.set({ left: (cb.left ?? 0) + 20, top: (cb.top ?? 0) + 20 });
    });
  }, []);
  const pasteRef = useRef(pasteClipboardFn);
  pasteRef.current = pasteClipboardFn;

  const undoRef = useRef(undo);
  undoRef.current = undo;
  const redoRef = useRef(redo);
  redoRef.current = redo;

  /* ─── 통합 키보드 핸들러 (ref 기반 — 한 번만 등록, 의존성 없음) ─── */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const fc = fcRef.current;
      if (!fc) return;
      const active = fc.getActiveObject();
      // 텍스트 편집 중이면 무시
      if (active && (active as any).isEditing) return;

      if (e.ctrlKey && (e.key === 'c' || e.key === 'C' || e.code === 'KeyC')) {
        e.preventDefault();
        e.stopPropagation();
        copyRef.current();
        return;
      }
      if (e.ctrlKey && (e.key === 'v' || e.key === 'V' || e.code === 'KeyV')) {
        e.preventDefault();
        e.stopPropagation();
        pasteRef.current();
        return;
      }
      if (e.ctrlKey && (e.key === 'z' || e.key === 'Z' || e.code === 'KeyZ')) {
        e.preventDefault();
        undoRef.current();
        return;
      }
      if (e.ctrlKey && (e.key === 'y' || e.key === 'Y' || e.code === 'KeyY')) {
        e.preventDefault();
        redoRef.current();
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        const objs = fc.getActiveObjects();
        if (objs.length === 0) return;
        objs.forEach(o => fc.remove(o));
        fc.discardActiveObject();
        fc.renderAll();
        pushHistoryRef.current();
        saveToParentRef.current();
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, []); // 빈 의존성 — ref로 최신 함수 접근

  /* ─── Legend selection ─── */
  const selectLegend = (item: LegendItem) => {
    if (activeLegend === item.label) {
      setActiveLegend(null);
      setTool('select');
      return;
    }
    setActiveLegend(item.label);
    setTool(item.drawType);
    setStroke(item.stroke);
    setFill(item.fill);
    setStrokeWidth(item.strokeWidth);
  };

  /* ─── Actions ─── */
  const deleteSelected = () => {
    const fc = fcRef.current;
    if (!fc) return;
    const objs = fc.getActiveObjects();
    objs.forEach(o => fc.remove(o));
    fc.discardActiveObject();
    fc.renderAll();
    pushHistory();
    saveToParent();
  };

  const clearAll = () => {
    if (!confirm('모든 도형을 삭제하시겠습니까?')) return;
    const fc = fcRef.current;
    if (!fc) return;
    fc.clear();
    fc.backgroundColor = '#ffffff';
    // Re-add grid
    loadFabric().then(fabric => {
      for (let x = 0; x <= CANVAS_W; x += 50) {
        fc.add(new fabric.Line([x, 0, x, CANVAS_H], {
          stroke: '#f0f0f0', strokeWidth: 1, selectable: false, evented: false, excludeFromExport: false,
        }));
      }
      for (let y = 0; y <= CANVAS_H; y += 50) {
        fc.add(new fabric.Line([0, y, CANVAS_W, y], {
          stroke: '#f0f0f0', strokeWidth: 1, selectable: false, evented: false, excludeFromExport: false,
        }));
      }
      fc.renderAll();
      pushHistory();
      saveToParent();
    });
  };

  const exportPng = () => {
    const fc = fcRef.current;
    if (!fc) return;
    const dataURL = fc.toDataURL({ format: 'png', multiplier: 2 });
    const a = document.createElement('a');
    a.download = '구성도.png';
    a.href = dataURL;
    a.click();
  };

  const importImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      if (!dataUrl) return;
      loadFabric().then(fabric => {
        const fc = fcRef.current;
        if (!fc) return;
        const imgEl = new Image();
        imgEl.onload = () => {
          const fImg = new fabric.FabricImage(imgEl, {
            left: 20,
            top: 20,
          });
          // scale to fit canvas
          const maxW = CANVAS_W - 40;
          const maxH = CANVAS_H - 40;
          const scale = Math.min(maxW / imgEl.width, maxH / imgEl.height, 1);
          fImg.scale(scale);
          fc.add(fImg);
          fc.sendObjectToBack(fImg);
          // Re-send grid to back (keep image above grid)
          fc.renderAll();
          pushHistory();
          saveToParent();
        };
        imgEl.src = dataUrl;
      });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleZoom = (delta: number) => {
    const fc = fcRef.current;
    if (!fc) return;
    const newZoom = Math.max(0.2, Math.min(3, zoom + delta));
    setZoom(newZoom);
    fc.setZoom(newZoom);
    fc.renderAll();
  };

  const resetView = () => {
    const fc = fcRef.current;
    if (!fc) return;
    setZoom(1);
    fc.setZoom(1);
    const vpt = fc.viewportTransform!;
    vpt[4] = 0;
    vpt[5] = 0;
    fc.renderAll();
  };

  /* ─── TOOLS config ─── */
  const TOOLS: { id: Tool; icon: React.ReactNode; label: string }[] = [
    { id: 'select', icon: <MousePointer2 className="h-4 w-4" />, label: '선택' },
    { id: 'pan', icon: <Move className="h-4 w-4" />, label: '이동' },
    { id: 'rect', icon: <Square className="h-4 w-4" />, label: '사각형' },
    { id: 'ellipse', icon: <Circle className="h-4 w-4" />, label: '원' },
    { id: 'line', icon: <Minus className="h-4 w-4" />, label: '선' },
    { id: 'arrow', icon: <ArrowRight className="h-4 w-4" />, label: '화살표' },
    { id: 'text', icon: <Type className="h-4 w-4" />, label: '텍스트' },
    { id: 'freehand', icon: <Pencil className="h-4 w-4" />, label: '자유선' },
    { id: 'callout', icon: <MessageSquare className="h-4 w-4" />, label: '말풍선' },
    { id: 'labelCallout', icon: <Tag className="h-4 w-4" />, label: '첨부말풍선' },
  ];

  return (
    <div className="flex flex-col gap-2">
      <h3 className="font-bold text-lg">구성도</h3>

      {/* 툴바 */}
      <div className="flex flex-wrap items-center gap-1 p-2 bg-gray-50 rounded border text-sm">
        {TOOLS.map(t => (
          <button key={t.id} title={t.label}
            className={`p-1.5 rounded ${tool === t.id && !activeLegend ? 'bg-blue-600 text-white' : 'hover:bg-gray-200'}`}
            onClick={() => { setTool(t.id); setActiveLegend(null); }}
          >{t.icon}</button>
        ))}

        <div className="w-px h-6 bg-gray-300 mx-1" />

        {/* 선 색상 */}
        <span className="text-xs text-gray-500 ml-1">선:</span>
        {COLORS.map(c => (
          <button key={c} className={`w-5 h-5 rounded border-2 ${stroke === c ? 'border-blue-600 scale-110' : 'border-gray-300'}`}
            style={{ backgroundColor: c }}
            onClick={() => setStroke(c)} />
        ))}

        <div className="w-px h-6 bg-gray-300 mx-1" />

        {/* 채우기 */}
        <span className="text-xs text-gray-500">채우기:</span>
        <button className={`w-5 h-5 rounded border-2 ${fill === 'transparent' ? 'border-blue-600' : 'border-gray-300'}`}
          style={{ background: 'repeating-conic-gradient(#ccc 0% 25%, transparent 0% 50%) 50%/8px 8px' }}
          onClick={() => setFill('transparent')} title="투명" />
        {COLORS.map(c => (
          <button key={c} className={`w-5 h-5 rounded border-2 ${fill === c ? 'border-blue-600 scale-110' : 'border-gray-300'}`}
            style={{ backgroundColor: c }}
            onClick={() => setFill(c)} />
        ))}

        <div className="w-px h-6 bg-gray-300 mx-1" />

        {/* 선 굵기 */}
        <span className="text-xs text-gray-500">굵기:</span>
        <select className="border rounded px-1 py-0.5 text-xs" value={strokeWidth}
          onChange={e => setStrokeWidth(Number(e.target.value))}>
          {STROKE_WIDTHS.map(w => <option key={w} value={w}>{w}px</option>)}
        </select>

        {/* 폰트 크기 */}
        <span className="text-xs text-gray-500 ml-1">글자:</span>
        <select className="border rounded px-1 py-0.5 text-xs" value={fontSize}
          onChange={e => setFontSize(Number(e.target.value))}>
          {[10, 12, 14, 16, 18, 20, 24, 28, 32, 40].map(s => <option key={s} value={s}>{s}px</option>)}
        </select>

        <div className="w-px h-6 bg-gray-300 mx-1" />

        {/* 실행취소 / 다시 */}
        <button className="p-1.5 rounded hover:bg-gray-200 disabled:opacity-30" disabled={historyIdx <= 0}
          onClick={undo} title="실행취소 (Ctrl+Z)"><Undo2 className="h-4 w-4" /></button>
        <button className="p-1.5 rounded hover:bg-gray-200 disabled:opacity-30" disabled={historyIdx >= historyLen - 1}
          onClick={redo} title="다시실행 (Ctrl+Y)"><Redo2 className="h-4 w-4" /></button>

        <div className="w-px h-6 bg-gray-300 mx-1" />

        <button className="p-1.5 rounded hover:bg-gray-200" onClick={copySelectedFn}
          title="복사 (Ctrl+C)"><Copy className="h-4 w-4" /></button>
        <button className="p-1.5 rounded hover:bg-gray-200 disabled:opacity-30" disabled={!clipboard}
          onClick={pasteClipboardFn} title="붙여넣기 (Ctrl+V)"><ClipboardPaste className="h-4 w-4" /></button>
        <button className="p-1.5 rounded hover:bg-gray-200" onClick={deleteSelected}
          title="선택 삭제"><Trash2 className="h-4 w-4" /></button>
        <button className="p-1.5 rounded hover:bg-red-100 text-red-600"
          onClick={clearAll} title="전체 삭제"><Trash2 className="h-4 w-4" /></button>

        <div className="flex-1" />

        {/* 이미지 불러오기 */}
        <label className="cursor-pointer p-1.5 rounded hover:bg-gray-200 flex items-center gap-1 text-xs" title="배경 이미지 불러오기">
          <Upload className="h-4 w-4" /> 이미지
          <input type="file" accept="image/*" className="hidden" onChange={importImage} />
        </label>

        <Button variant="outline" size="sm" className="gap-1 h-7 text-xs" onClick={exportPng}>
          <Download className="h-3.5 w-3.5" /> PNG 저장
        </Button>

        {/* 줌 */}
        <span className="text-xs text-gray-500 ml-2">{Math.round(zoom * 100)}%</span>
        <button className="text-xs px-1 border rounded hover:bg-gray-200" onClick={() => handleZoom(-0.1)}>−</button>
        <button className="text-xs px-1 border rounded hover:bg-gray-200" onClick={() => handleZoom(0.1)}>+</button>
        <button className="text-xs px-1 border rounded hover:bg-gray-200" onClick={resetView}>맞춤</button>
      </div>

      {/* 캔버스 + 범례 */}
      <div className="flex gap-2">
        {/* Fabric.js 캔버스 */}
        <div className="border rounded bg-white overflow-hidden relative flex-1" style={{ height: '620px' }}>
          <canvas ref={canvasElRef} />
        </div>

        {/* 범례 패널 */}
        <div className="w-44 border rounded p-2 bg-gray-50 flex flex-col gap-1">
          <h4 className="font-bold text-sm mb-1">범례</h4>
          {LEGEND_ITEMS.map(item => (
            <button
              key={item.label}
              className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs text-left transition-colors
                ${activeLegend === item.label ? 'bg-blue-100 ring-1 ring-blue-400' : 'hover:bg-gray-100'}`}
              onClick={() => selectLegend(item)}
            >
              {item.drawType === 'line' ? (
                <svg width="28" height="12"><line x1="0" y1="6" x2="28" y2="6" stroke={item.stroke} strokeWidth={item.strokeWidth} /></svg>
              ) : (
                <svg width="20" height="14"><rect x="1" y="1" width="18" height="12" rx="2" fill={item.fill} stroke={item.stroke} strokeWidth={item.strokeWidth} /></svg>
              )}
              <span>{item.label}</span>
            </button>
          ))}
          <div className="border-t mt-2 pt-2">
            <p className="text-[10px] text-gray-400 leading-tight">
              범례를 클릭하면 해당 스타일로 도형이 그려집니다. 다시 클릭하면 해제됩니다.
            </p>
          </div>

          {/* 말풍선 도구 패널 */}
          <div className="border-t mt-2 pt-2">
            <h4 className="font-bold text-sm mb-1">말풍선</h4>
            <div className="grid grid-cols-2 gap-1">
              {CALLOUT_PRESETS.map(cp => (
                <button
                  key={cp.id}
                  className={`flex flex-col items-center p-1.5 rounded border text-[10px] transition-colors
                    ${tool === 'callout' && calloutStyle === cp.id
                      ? 'bg-blue-100 border-blue-400 ring-1 ring-blue-400'
                      : 'hover:bg-gray-100 border-gray-200'}`}
                  onClick={() => {
                    setTool('callout');
                    setCalloutStyle(cp.id);
                    setActiveLegend(null);
                  }}
                  title={`말풍선 (${cp.label})`}
                >
                  <svg width="36" height="32" viewBox="0 0 36 32">
                    {/* 본체 사각형 */}
                    <rect x="2" y="2" width="32" height="16" rx="3" fill="white" stroke="#333" strokeWidth="1.5" />
                    {/* 꼬리 */}
                    {cp.id === 'bottomLeft' && (
                      <polyline points="8,18 4,28 14,18" fill="white" stroke="#333" strokeWidth="1.5" strokeLinejoin="round" />
                    )}
                    {cp.id === 'bottomCenter' && (
                      <polyline points="14,18 18,28 22,18" fill="white" stroke="#333" strokeWidth="1.5" strokeLinejoin="round" />
                    )}
                    {cp.id === 'bottomRight' && (
                      <polyline points="22,18 32,28 28,18" fill="white" stroke="#333" strokeWidth="1.5" strokeLinejoin="round" />
                    )}
                    {cp.id === 'leftCenter' && (
                      <polyline points="2,7 -6,14 2,13" fill="white" stroke="#333" strokeWidth="1.5" strokeLinejoin="round" />
                    )}
                  </svg>
                  <span>{cp.label}</span>
                </button>
              ))}
            </div>
            <p className="text-[10px] text-gray-400 leading-tight mt-1">
              말풍선을 선택 후 캔버스에서 드래그하세요.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
