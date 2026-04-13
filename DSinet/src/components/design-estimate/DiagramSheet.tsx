'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  MousePointer2, Move, Square, Circle, Minus, ArrowRight,
  Type, Spline, Palette, Trash2, Undo2, Redo2, Copy,
  ClipboardPaste, Download, Upload, ZoomIn, ZoomOut,
  CornerDownRight, Eraser, MessageSquare, Save,
} from 'lucide-react';

/* ─── Types ─── */
interface Pt { x: number; y: number }
interface BBox { x1: number; y1: number; x2: number; y2: number }

interface DiagramObject {
  id: string;
  type: 'rect' | 'ellipse' | 'line' | 'arrow' | 'polyline' | 'freehand' | 'text' | 'callout' | 'stamp';
  x: number;
  y: number;
  w?: number;
  h?: number;
  x2?: number;
  y2?: number;
  points?: Pt[];
  stroke: string;
  fill: string;
  strokeWidth: number;
  fontSize?: number;
  text?: string;
  tailX?: number;
  tailY?: number;
}

export interface DiagramData {
  objects?: DiagramObject[];
  canvasWidth: number;
  canvasHeight: number;
  fabricJSON?: unknown;
  savedImage?: string; // base64 PNG
  legends?: LegendItem[];
  stamps?: LegendItem[];
}

type Tool = 'select' | 'pan' | 'rect' | 'ellipse' | 'callout' | 'polyline' | 'line' | 'arrow' | 'text' | 'freehand' | 'eraser';

/* ─── Constants ─── */
const CW = 1200, CH = 800, SNAP_R = 12;
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
const PALETTE = [
  { id: 'bk', c: '#1e293b' }, { id: 'rd', c: '#ef4444' }, { id: 'bl', c: '#3b82f6' },
  { id: 'gn', c: '#22c55e' }, { id: 'pp', c: '#a855f7' }, { id: 'or', c: '#f97316' },
  { id: 'cy', c: '#06b6d4' }, { id: 'wh', c: '#ffffff' },
];
const WIDTHS = [1, 2, 3, 4, 6, 8];

interface LegendItem { label: string; shape: Tool; stroke: string; fill: string; sw: number; stampText?: string }
const DEFAULT_LEGEND: LegendItem[] = [
  { label: '광케이블 4C', shape: 'polyline', stroke: '#ef4444', fill: 'transparent', sw: 3 },
  { label: '광점퍼케이블', shape: 'polyline', stroke: '#a855f7', fill: 'transparent', sw: 3 },
  { label: 'UTP케이블', shape: 'polyline', stroke: '#06b6d4', fill: 'transparent', sw: 3 },
];
const DEFAULT_STAMPS: LegendItem[] = [
  { label: 'EPS', shape: 'callout', stroke: '#dc2626', fill: '#ffffff', sw: 2, stampText: 'EPS' },
  { label: 'MDF', shape: 'callout', stroke: '#2563eb', fill: '#ffffff', sw: 2, stampText: 'MDF' },
  { label: 'IDF', shape: 'callout', stroke: '#16a34a', fill: '#ffffff', sw: 2, stampText: 'IDF' },
  { label: 'HUB', shape: 'callout', stroke: '#a855f7', fill: '#ffffff', sw: 2, stampText: 'HUB' },
  { label: '통신랙', shape: 'callout', stroke: '#16a34a', fill: '#ffffff', sw: 2, stampText: '통신랙' },
  { label: 'L2스위치', shape: 'callout', stroke: '#dc2626', fill: '#ffffff', sw: 2, stampText: 'L2스위치' },
];
const STAMP_W = 70, STAMP_H = 36; // 통신랙 기준 통일 크기

/* ─── Helpers ─── */
function bbox(o: DiagramObject): BBox {
  switch (o.type) {
    case 'rect': case 'ellipse': return { x1: o.x, y1: o.y, x2: o.x + (o.w ?? 0), y2: o.y + (o.h ?? 0) };
    case 'callout': { const tx = o.tailX ?? o.x, ty = o.tailY ?? (o.y + (o.h ?? 0) + 30); return { x1: Math.min(o.x, tx), y1: Math.min(o.y, ty), x2: Math.max(o.x + (o.w ?? 0), tx), y2: Math.max(o.y + (o.h ?? 0), ty) }; }
    case 'stamp': return { x1: o.x, y1: o.y, x2: o.x + (o.w ?? 0), y2: o.y + (o.h ?? 0) };
    case 'line': case 'arrow': return { x1: Math.min(o.x, o.x2 ?? 0), y1: Math.min(o.y, o.y2 ?? 0), x2: Math.max(o.x, o.x2 ?? 0), y2: Math.max(o.y, o.y2 ?? 0) };
    case 'polyline': case 'freehand': { if (!o.points?.length) return { x1: o.x, y1: o.y, x2: o.x, y2: o.y }; let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity; for (const p of o.points) { a = Math.min(a, p.x); b = Math.min(b, p.y); c = Math.max(c, p.x); d = Math.max(d, p.y); } return { x1: a, y1: b, x2: c, y2: d }; }
    case 'text': { const fs = o.fontSize ?? 14; return { x1: o.x, y1: o.y - fs, x2: o.x + (o.text?.length ?? 1) * fs * 0.6, y2: o.y + 4 }; }
    default: return { x1: o.x, y1: o.y, x2: o.x + 10, y2: o.y + 10 };
  }
}
function overlap(a: BBox, b: BBox) { return a.x1 <= b.x2 && a.x2 >= b.x1 && a.y1 <= b.y2 && a.y2 >= b.y1; }
function dist(a: Pt, b: Pt) { return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2); }
function moveObj(o: DiagramObject, dx: number, dy: number): DiagramObject {
  const m: DiagramObject = { ...o, x: o.x + dx, y: o.y + dy };
  if (o.x2 !== undefined) m.x2 = (o.x2 ?? 0) + dx;
  if (o.y2 !== undefined) m.y2 = (o.y2 ?? 0) + dy;
  if (o.points) m.points = o.points.map(p => ({ x: p.x + dx, y: p.y + dy }));
  if (o.tailX !== undefined) { m.tailX = (o.tailX ?? 0) + dx; m.tailY = (o.tailY ?? 0) + dy; }
  return m;
}
function simplify(pts: Pt[], eps = 1.5): Pt[] {
  if (pts.length < 3) return pts;
  let mx = 0, mi = 0;
  const s = pts[0], e = pts[pts.length - 1], dx = e.x - s.x, dy = e.y - s.y, len = Math.sqrt(dx * dx + dy * dy);
  for (let i = 1; i < pts.length - 1; i++) {
    const d = len === 0 ? dist(pts[i], s) : Math.abs(dy * pts[i].x - dx * pts[i].y + e.x * s.y - e.y * s.x) / len;
    if (d > mx) { mx = d; mi = i; }
  }
  if (mx > eps) { const l = simplify(pts.slice(0, mi + 1), eps), r = simplify(pts.slice(mi), eps); return [...l.slice(0, -1), ...r]; }
  return [s, e];
}
function calloutPath(o: DiagramObject) {
  const x = o.x, y = o.y, w = o.w ?? 120, h = o.h ?? 60, r = Math.min(6, w / 4, h / 4);
  const tx = o.tailX ?? (x + w * 0.3), ty = o.tailY ?? (y + h + 30);
  const tw = Math.min(20, w * 0.25);
  const midY = y + h / 2;
  if (ty < midY) {
    // tail on TOP edge
    const t1x = Math.max(x + r, Math.min(x + w / 2 - tw / 2, x + w - r - tw)), t2x = t1x + tw;
    return `M${x + r},${y} L${t1x},${y} L${tx},${ty} L${t2x},${y} L${x + w - r},${y} Q${x + w},${y} ${x + w},${y + r} L${x + w},${y + h - r} Q${x + w},${y + h} ${x + w - r},${y + h} L${x + r},${y + h} Q${x},${y + h} ${x},${y + h - r} L${x},${y + r} Q${x},${y} ${x + r},${y} Z`;
  }
  // tail on BOTTOM edge (default)
  const t1x = Math.max(x + r, Math.min(x + w / 2 - tw / 2, x + w - r - tw)), t2x = t1x + tw;
  return `M${x + r},${y} L${x + w - r},${y} Q${x + w},${y} ${x + w},${y + r} L${x + w},${y + h - r} Q${x + w},${y + h} ${x + w - r},${y + h} L${t2x},${y + h} L${tx},${ty} L${t1x},${y + h} L${x + r},${y + h} Q${x},${y + h} ${x},${y + h - r} L${x},${y + r} Q${x},${y} ${x + r},${y} Z`;
}

/* ─── Standalone SVG→PNG export for Excel ─── */
function objToSvg(o: DiagramObject): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  switch (o.type) {
    case 'rect':
      if (o.text?.startsWith('data:image')) return `<image href="${o.text}" x="${o.x}" y="${o.y}" width="${o.w}" height="${o.h}" preserveAspectRatio="xMidYMid meet"/>`;
      return `<rect x="${o.x}" y="${o.y}" width="${o.w ?? 0}" height="${o.h ?? 0}" fill="${o.fill}" stroke="${o.stroke}" stroke-width="${o.strokeWidth}" rx="2"/>`;
    case 'ellipse':
      return `<ellipse cx="${o.x + (o.w ?? 0) / 2}" cy="${o.y + (o.h ?? 0) / 2}" rx="${(o.w ?? 0) / 2}" ry="${(o.h ?? 0) / 2}" fill="${o.fill}" stroke="${o.stroke}" stroke-width="${o.strokeWidth}"/>`;
    case 'line':
      return `<line x1="${o.x}" y1="${o.y}" x2="${o.x2}" y2="${o.y2}" stroke="${o.stroke}" stroke-width="${o.strokeWidth}"/>`;
    case 'arrow': {
      const mid = `arr-${o.id}`;
      return `<defs><marker id="${mid}" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto"><polygon points="0 0,10 3.5,0 7" fill="${o.stroke}"/></marker></defs><line x1="${o.x}" y1="${o.y}" x2="${o.x2}" y2="${o.y2}" stroke="${o.stroke}" stroke-width="${o.strokeWidth}" marker-end="url(#${mid})"/>`;
    }
    case 'callout': {
      const pathD = calloutPath(o);
      const fs = o.fontSize ?? 14;
      const lines = (o.text || '').split('\n');
      const textEls = lines.map((line, li) => `<text x="${o.x + 8}" y="${o.y + fs + 4 + li * (fs + 2)}" fill="${o.stroke}" font-size="${fs}" font-weight="500" font-family="sans-serif">${esc(line)}</text>`).join('');
      return `<path d="${pathD}" fill="${o.fill || '#fffde7'}" stroke="${o.stroke}" stroke-width="${o.strokeWidth}" stroke-linejoin="round"/>${textEls}`;
    }
    case 'polyline': {
      if (!o.points || o.points.length < 2) return '';
      const d = o.points.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' ');
      return `<path d="${d}" fill="none" stroke="${o.stroke}" stroke-width="${o.strokeWidth}" stroke-linecap="round" stroke-linejoin="round"/>`;
    }
    case 'text':
      return `<text x="${o.x}" y="${o.y}" fill="${o.stroke}" font-size="${o.fontSize ?? 14}" font-weight="600" font-family="sans-serif">${esc(o.text || '')}</text>`;
    case 'stamp': {
      const w = o.w ?? 70, h = o.h ?? 36, fs = o.fontSize ?? 14, r = Math.min(6, w / 4, h / 4);
      return `<rect x="${o.x}" y="${o.y}" width="${w}" height="${h}" rx="${r}" ry="${r}" fill="${o.fill || '#ffffff'}" stroke="${o.stroke}" stroke-width="${o.strokeWidth}"/><text x="${o.x + w / 2}" y="${o.y + h / 2 + fs * 0.35}" fill="${o.stroke}" font-size="${fs}" font-weight="700" font-family="sans-serif" text-anchor="middle">${esc(o.text || '')}</text>`;
    }
    case 'freehand': {
      if (!o.points || o.points.length < 2) return '';
      const d = o.points.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' ');
      return `<path d="${d}" fill="none" stroke="${o.stroke}" stroke-width="${o.strokeWidth}" stroke-linecap="round" stroke-linejoin="round"/>`;
    }
  }
  return '';
}

function buildLegendSvg(w: number, legends: LegendItem[], stamps: LegendItem[]): string {
  const allItems = [...legends, ...stamps.map(s => ({ ...s, label: s.stampText || s.label }))];
  const lw = 160, pad = 10, lineH = 22, titleH = 28;
  const lh = titleH + allItems.length * lineH + pad;
  const lx = w - lw - pad, ly = pad;
  let svg = `<rect x="${lx}" y="${ly}" width="${lw}" height="${lh}" rx="6" fill="#fff" stroke="#94a3b8" stroke-width="1" opacity="0.95"/>`;
  svg += `<text x="${lx + lw / 2}" y="${ly + 20}" fill="#1e293b" font-size="14" font-weight="700" font-family="sans-serif" text-anchor="middle">범 례</text>`;
  svg += `<line x1="${lx + 8}" y1="${ly + titleH - 2}" x2="${lx + lw - 8}" y2="${ly + titleH - 2}" stroke="#cbd5e1" stroke-width="0.8"/>`;
  allItems.forEach((item, i) => {
    const iy = ly + titleH + i * lineH + lineH / 2;
    if (item.shape === 'polyline') {
      svg += `<line x1="${lx + pad}" y1="${iy}" x2="${lx + pad + 24}" y2="${iy}" stroke="${item.stroke}" stroke-width="${item.sw}"/>`;
    } else {
      svg += `<rect x="${lx + pad}" y="${iy - 6}" width="14" height="12" rx="2" fill="${item.stroke}" stroke="${item.stroke}" stroke-width="1"/>`;
    }
    svg += `<text x="${lx + pad + 30}" y="${iy + 4}" fill="#334155" font-size="12" font-weight="500" font-family="sans-serif">${item.label}</text>`;
  });
  return svg;
}

export function diagramToBase64(data?: DiagramData): Promise<string | null> {
  if (!data?.objects?.length) return Promise.resolve(null);
  const w = data.canvasWidth || 1200, h = data.canvasHeight || 800;
  if (data.savedImage) return Promise.resolve(data.savedImage);
  const legs = data.legends?.length ? data.legends : DEFAULT_LEGEND;
  const stps = data.stamps?.length ? data.stamps : DEFAULT_STAMPS;
  const body = data.objects.map(o => objToSvg(o)).join('') + buildLegendSvg(w, legs, stps);
  const svgStr = `<svg xmlns="http://www.w3.org/2000/svg" width="${w * 2}" height="${h * 2}" viewBox="0 0 ${w} ${h}">${body}</svg>`;
  return new Promise(resolve => {
    const cvs = document.createElement('canvas');
    cvs.width = w * 2; cvs.height = h * 2;
    const ctx = cvs.getContext('2d')!;
    const img = new Image();
    img.onload = () => { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w * 2, h * 2); ctx.drawImage(img, 0, 0); resolve(cvs.toDataURL('image/png').split(',')[1]); };
    img.onerror = () => resolve(null);
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgStr)));
  });
}

/* ─── Component ─── */
export function DiagramSheet({ value, onChange }: { value?: DiagramData; onChange: (d: DiagramData) => void }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [objs, setObjs] = useState<DiagramObject[]>([]);
  const [tool, setTool] = useState<Tool>('select');
  const [stroke, setStroke] = useState('#1e293b');
  const [fill, setFill] = useState('transparent');
  const [sw, setSw] = useState(2);
  const [fontSize, setFontSize] = useState(16);
  const [sel, setSel_] = useState<Set<string>>(new Set());
  const selRef = useRef<Set<string>>(new Set());
  const setSel = (s: Set<string> | string[]) => { const v = s instanceof Set ? s : new Set(s); selRef.current = v; setSel_(v); };
  const [hist, setHist] = useState<DiagramObject[][]>([[]]);
  const [hIdx, setHIdx] = useState(0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [panning, setPanning] = useState(false);
  const panStartRef = useRef<Pt | null>(null);
  const activeRef = useRef(false);
  const modeRef = useRef<'idle' | 'draw' | 'marquee' | 'groupDrag' | 'resize'>('idle');
  const startRef = useRef<Pt | null>(null);
  const [cur, setCur] = useState<DiagramObject | null>(null);
  const [marquee, setMarquee] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const [editText, setEditText] = useState<string | null>(null);
  const resRef = useRef<{ h: string; sp: Pt; orig: DiagramObject } | null>(null);
  const groupStartRef = useRef<Pt | null>(null);
  const [polyPts, setPolyPts] = useState<Pt[]>([]);
  const [polyPreview, setPolyPreview] = useState<Pt | null>(null);
  const polyRef = useRef(false);
  const [snap, setSnap] = useState<Pt | null>(null);
  const [legend, setLegend] = useState<string | null>(null);
  const legendRef = useRef<string | null>(null);
  useEffect(() => { legendRef.current = legend; }, [legend]);
  const [legendItems, setLegendItems] = useState<LegendItem[]>(value?.legends?.length ? value.legends : DEFAULT_LEGEND);
  const [stampItems, setStampItems] = useState<LegendItem[]>(value?.stamps?.length ? value.stamps : DEFAULT_STAMPS);
  const [clip, setClip] = useState<DiagramObject[] | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const initRef = useRef(false);

  // Load saved data on mount
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    if (value?.objects?.length) {
      setObjs(value.objects);
      setHist([value.objects]);
      setHIdx(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveToParent = useCallback((objects: DiagramObject[], extra?: Partial<DiagramData>) => {
    onChangeRef.current({ ...value, objects, canvasWidth: CW, canvasHeight: CH, legends: legendItems, stamps: stampItems, ...extra });
  }, [value, legendItems, stampItems]);

  const ptFn = useCallback((e: { clientX: number; clientY: number }): Pt => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    return { x: (e.clientX - ctm.e) / ctm.a, y: (e.clientY - ctm.f) / ctm.d };
  }, []);

  const commit = useCallback((next: DiagramObject[]) => {
    setObjs(next);
    setHist(p => { const h = p.slice(0, hIdx + 1); h.push(next); return h; });
    setHIdx(p => p + 1);
    saveToParent(next);
  }, [hIdx, saveToParent]);

  const undo = () => { if (hIdx <= 0) return; setHIdx(hIdx - 1); setObjs(hist[hIdx - 1]); saveToParent(hist[hIdx - 1]); };
  const redo = () => { if (hIdx >= hist.length - 1) return; setHIdx(hIdx + 1); setObjs(hist[hIdx + 1]); saveToParent(hist[hIdx + 1]); };

  /* ─── Apply toolbar changes to selected objects ─── */
  const applyToSel = useCallback((updater: (o: DiagramObject) => DiagramObject) => {
    if (!selRef.current.size) return;
    const next = objs.map(o => selRef.current.has(o.id) ? updater(o) : o);
    commit(next);
  }, [objs, commit]);
  const changeStroke = (c: string) => { setStroke(c); applyToSel(o => ({ ...o, stroke: c })); };
  const changeFill = (c: string) => { setFill(c); applyToSel(o => ({ ...o, fill: c })); };
  const changeSw = (v: number) => { setSw(v); applyToSel(o => ({ ...o, strokeWidth: v })); };
  const changeFontSize = (v: number) => { setFontSize(v); applyToSel(o => ({ ...o, fontSize: v })); };

  const findSnap = useCallback((p: Pt): Pt | null => {
    let best: Pt | null = null, md = SNAP_R / zoom;
    for (const o of objs) {
      const eps: Pt[] = [];
      if (o.type === 'line' || o.type === 'arrow') eps.push({ x: o.x, y: o.y }, { x: o.x2 ?? 0, y: o.y2 ?? 0 });
      else if (o.type === 'polyline' && o.points?.length) eps.push(o.points[0], o.points[o.points.length - 1]);
      else if (o.type === 'rect' || o.type === 'ellipse' || o.type === 'callout' || o.type === 'stamp') { const cx2 = o.x + (o.w ?? 0) / 2, cy2 = o.y + (o.h ?? 0) / 2; eps.push({ x: cx2, y: o.y }, { x: cx2, y: o.y + (o.h ?? 0) }, { x: o.x, y: cy2 }, { x: o.x + (o.w ?? 0), y: cy2 }); }
      for (const e of eps) { const d = dist(p, e); if (d < md) { md = d; best = e; } }
    }
    return best;
  }, [objs, zoom]);

  const hitFn = useCallback((o: DiagramObject, p: Pt): boolean => {
    const m = 8;
    switch (o.type) {
      case 'rect': return p.x >= o.x - m && p.x <= o.x + (o.w ?? 0) + m && p.y >= o.y - m && p.y <= o.y + (o.h ?? 0) + m;
      case 'callout': { if (p.x >= o.x - m && p.x <= o.x + (o.w ?? 0) + m && p.y >= o.y - m && p.y <= o.y + (o.h ?? 0) + m) return true; const tx = o.tailX ?? (o.x + (o.w ?? 0) * 0.3), ty = o.tailY ?? (o.y + (o.h ?? 0) + 30); return dist(p, { x: tx, y: ty }) < m + 5; }
      case 'ellipse': { const cx2 = o.x + (o.w ?? 0) / 2, cy2 = o.y + (o.h ?? 0) / 2, rx = (o.w ?? 0) / 2 + m, ry = (o.h ?? 0) / 2 + m; return ((p.x - cx2) ** 2 / rx ** 2 + (p.y - cy2) ** 2 / ry ** 2) <= 1; }
      case 'line': case 'arrow': { const dx = (o.x2 ?? 0) - o.x, dy = (o.y2 ?? 0) - o.y, ln = Math.sqrt(dx * dx + dy * dy); if (!ln) return false; const t = Math.max(0, Math.min(1, ((p.x - o.x) * dx + (p.y - o.y) * dy) / (ln * ln))); return dist(p, { x: o.x + t * dx, y: o.y + t * dy }) < m; }
      case 'polyline': { if (!o.points || o.points.length < 2) return false; for (let i = 0; i < o.points.length - 1; i++) { const a = o.points[i], b = o.points[i + 1], dx = b.x - a.x, dy = b.y - a.y, ln = Math.sqrt(dx * dx + dy * dy); if (!ln) continue; const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (ln * ln))); if (dist(p, { x: a.x + t * dx, y: a.y + t * dy }) < m) return true; } return false; }
      case 'stamp': return p.x >= o.x - m && p.x <= o.x + (o.w ?? 0) + m && p.y >= o.y - m && p.y <= o.y + (o.h ?? 0) + m;
      case 'text': return p.x >= o.x - m && p.x <= o.x + (o.text?.length ?? 1) * (o.fontSize ?? 14) * 0.6 + m && p.y >= o.y - (o.fontSize ?? 14) - m && p.y <= o.y + m;
      case 'freehand': return o.points?.some(q => dist(p, q) < m) ?? false;
    }
    return false;
  }, []);

  const getHandles = (o: DiagramObject) => {
    const w = o.w ?? 0, h = o.h ?? 0;
    return [{ id: 'tl', x: o.x, y: o.y }, { id: 't', x: o.x + w / 2, y: o.y }, { id: 'tr', x: o.x + w, y: o.y }, { id: 'l', x: o.x, y: o.y + h / 2 }, { id: 'r', x: o.x + w, y: o.y + h / 2 }, { id: 'bl', x: o.x, y: o.y + h }, { id: 'b', x: o.x + w / 2, y: o.y + h }, { id: 'br', x: o.x + w, y: o.y + h }];
  };
  const hCursor = (id: string) => ({ tl: 'nwse-resize', tr: 'nesw-resize', bl: 'nesw-resize', br: 'nwse-resize', t: 'ns-resize', b: 'ns-resize', l: 'ew-resize', r: 'ew-resize' }[id] ?? 'default');

  const finishPoly = useCallback(() => {
    if (polyPts.length >= 2) commit([...objs, { id: uid(), type: 'polyline', x: polyPts[0].x, y: polyPts[0].y, points: [...polyPts], stroke, fill: 'transparent', strokeWidth: sw }]);
    setPolyPts([]); setPolyPreview(null); polyRef.current = false;
  }, [polyPts, objs, stroke, sw, commit]);

  const extendPoly = (obj: DiagramObject, fromEnd: boolean) => {
    if (obj.type !== 'polyline' || !obj.points) return;
    const pts = fromEnd ? [...obj.points] : [...obj.points].reverse();
    setObjs(p => p.filter(o => o.id !== obj.id));
    setPolyPts(pts); polyRef.current = true; setTool('polyline'); setStroke(obj.stroke); setSw(obj.strokeWidth);
  };

  /* ─── Event handlers ─── */
  const onDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button === 1) { setPanning(true); panStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y }; return; }
    if (e.button !== 0) return;
    const raw = ptFn(e), sn = findSnap(raw), p = sn || raw; setSnap(sn);
    if (tool === 'pan') { setPanning(true); panStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y }; return; }
    if (tool === 'polyline' || tool === 'line' || tool === 'arrow') {
      if (!polyRef.current) { polyRef.current = true; setPolyPts([p]); setPolyPreview(p); } else setPolyPts(v => [...v, p]);
      return;
    }
    if (tool === 'select') {
      const single = sel.size === 1 ? objs.find(o => sel.has(o.id)) : null;
      if (single && (single.type === 'rect' || single.type === 'ellipse' || single.type === 'callout')) {
        for (const h of getHandles(single)) { if (dist(p, h) < 8 / zoom) { resRef.current = { h: h.id, sp: p, orig: { ...single } }; modeRef.current = 'resize'; activeRef.current = true; return; } }
        if (single.type === 'callout') { const tx = single.tailX ?? (single.x + (single.w ?? 0) * 0.3), ty = single.tailY ?? (single.y + (single.h ?? 0) + 30); if (dist(p, { x: tx, y: ty }) < 10 / zoom) { resRef.current = { h: 'tail', sp: p, orig: { ...single } }; modeRef.current = 'resize'; activeRef.current = true; return; } }
      }
      if (single && (single.type === 'line' || single.type === 'arrow')) {
        if (dist(p, { x: single.x, y: single.y }) < 8 / zoom) { resRef.current = { h: 'p1', sp: p, orig: { ...single } }; modeRef.current = 'resize'; activeRef.current = true; return; }
        if (dist(p, { x: single.x2 ?? 0, y: single.y2 ?? 0 }) < 8 / zoom) { resRef.current = { h: 'p2', sp: p, orig: { ...single } }; modeRef.current = 'resize'; activeRef.current = true; return; }
      }
      if (single?.type === 'polyline' && single.points?.length && single.points.length >= 2) {
        const first = single.points[0], last = single.points[single.points.length - 1];
        if (dist(p, last) < 10 / zoom) { resRef.current = { h: 'polyEnd', sp: p, orig: { ...single, points: [...single.points] } }; modeRef.current = 'resize'; activeRef.current = true; return; }
        if (dist(p, first) < 10 / zoom) { resRef.current = { h: 'polyStart', sp: p, orig: { ...single, points: [...single.points] } }; modeRef.current = 'resize'; activeRef.current = true; return; }
      }
      const clicked = [...objs].reverse().find(o => hitFn(o, p));
      if (clicked) {
        if (e.shiftKey) { const n = new Set(sel); n.has(clicked.id) ? n.delete(clicked.id) : n.add(clicked.id); setSel(n); }
        else { if (!sel.has(clicked.id)) { setSel(new Set([clicked.id])); setStroke(clicked.stroke); setFill(clicked.fill); setSw(clicked.strokeWidth); if (clicked.fontSize) setFontSize(clicked.fontSize); } }
        groupStartRef.current = p; modeRef.current = 'groupDrag'; activeRef.current = true; return;
      }
      if (!e.shiftKey) setSel(new Set()); startRef.current = p; setMarquee({ x1: p.x, y1: p.y, x2: p.x, y2: p.y }); modeRef.current = 'marquee'; activeRef.current = true; return;
    }
    if (tool === 'text') { const obj: DiagramObject = { id: uid(), type: 'text', x: p.x, y: p.y, text: '', stroke, fill: 'transparent', strokeWidth: 1, fontSize }; commit([...objs, obj]); setEditText(obj.id); setSel(new Set([obj.id])); return; }
    // EPS 스탬프 배치 (현재 툴바의 선색·굵기·폰트크기 반영)
    const stampItem = [...legendItems, ...stampItems].find(it => it.label === legendRef.current && it.stampText);
    if (stampItem) {
      const fs = fontSize || 20;
      const obj: DiagramObject = { id: uid(), type: 'stamp', x: p.x - STAMP_W / 2, y: p.y - STAMP_H / 2, w: STAMP_W, h: STAMP_H, stroke, fill, strokeWidth: sw, fontSize: fs, text: stampItem.stampText! };
      commit([...objs, obj]); setSel(new Set([obj.id])); return;
    }
    if (tool === 'eraser') { const erased = [...objs].reverse().find(o => hitFn(o, p)); if (erased) commit(objs.filter(o => o.id !== erased.id)); return; }
    activeRef.current = true; modeRef.current = 'draw'; startRef.current = p;
    if (tool === 'freehand') setCur({ id: uid(), type: 'freehand', x: 0, y: 0, points: [p], stroke, fill: 'transparent', strokeWidth: sw });
    else if (tool === 'callout') setCur({ id: uid(), type: 'callout', x: p.x, y: p.y, w: 0, h: 0, tailX: p.x + 30, tailY: p.y + 80, text: '', stroke, fill: fill === 'transparent' ? '#fffde7' : fill, strokeWidth: sw, fontSize });
    else { const tp = tool === 'ellipse' ? 'ellipse' : 'rect'; setCur({ id: uid(), type: tp, x: p.x, y: p.y, w: 0, h: 0, stroke, fill, strokeWidth: sw }); }
  };

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (panning && panStartRef.current) { setPan({ x: e.clientX - panStartRef.current.x, y: e.clientY - panStartRef.current.y }); return; }
    const raw = ptFn(e), sn = findSnap(raw); setSnap(sn); const p = sn || raw;
    if (polyRef.current) { setPolyPreview(p); return; }
    if (!activeRef.current) return;
    const mode = modeRef.current;
    if (mode === 'marquee') {
      const mq = { x1: startRef.current!.x, y1: startRef.current!.y, x2: raw.x, y2: raw.y }; setMarquee(mq);
      const r = { x1: Math.min(mq.x1, mq.x2), y1: Math.min(mq.y1, mq.y2), x2: Math.max(mq.x1, mq.x2), y2: Math.max(mq.y1, mq.y2) };
      setSel(new Set(objs.filter(o => overlap(bbox(o), r)).map(o => o.id))); return;
    }
    if (mode === 'groupDrag' && groupStartRef.current) {
      const dx = raw.x - groupStartRef.current.x, dy = raw.y - groupStartRef.current.y;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
      const ids = selRef.current;
      setObjs(prev => prev.map(o => ids.has(o.id) ? moveObj(o, dx, dy) : o));
      groupStartRef.current = raw; return;
    }
    if (mode === 'resize' && resRef.current) {
      const rz = resRef.current, orig = rz.orig, dx = p.x - rz.sp.x, dy = p.y - rz.sp.y;
      setObjs(prev => prev.map(o => {
        if (o.id !== orig.id) return o;
        if (rz.h === 'p1') return { ...o, x: orig.x + dx, y: orig.y + dy };
        if (rz.h === 'p2') return { ...o, x2: (orig.x2 ?? 0) + dx, y2: (orig.y2 ?? 0) + dy };
        if (rz.h === 'tail') return { ...o, tailX: (orig.tailX ?? o.x + 30) + dx, tailY: (orig.tailY ?? o.y + 80) + dy };
        if (rz.h === 'polyEnd' && o.points) { const np = [...(orig.points ?? [])]; np[np.length - 1] = { x: np[np.length - 1].x + dx, y: np[np.length - 1].y + dy }; return { ...o, points: np }; }
        if (rz.h === 'polyStart' && o.points) { const np = [...(orig.points ?? [])]; np[0] = { x: np[0].x + dx, y: np[0].y + dy }; return { ...o, x: np[0].x, y: np[0].y, points: np }; }
        const ox = orig.x, oy = orig.y, ow = orig.w ?? 0, oh = orig.h ?? 0;
        let nx = ox, ny = oy, nw = ow, nh = oh;
        if (rz.h.includes('l')) { nx = ox + dx; nw = ow - dx; }
        if (rz.h.includes('r')) nw = ow + dx;
        if (rz.h.includes('t')) { ny = oy + dy; nh = oh - dy; }
        if (rz.h.includes('b')) nh = oh + dy;
        if (nw < 20) { nw = 20; if (rz.h.includes('l')) nx = ox + ow - 20; }
        if (nh < 16) { nh = 16; if (rz.h.includes('t')) ny = oy + oh - 16; }
        return { ...o, x: nx, y: ny, w: nw, h: nh };
      })); return;
    }
    if (mode === 'draw' && cur) {
      if (tool === 'freehand') setCur(v => v ? { ...v, points: [...(v.points ?? []), p] } : null);
      else {
        const s = startRef.current!, nx = Math.min(s.x, p.x), ny = Math.min(s.y, p.y), nw = Math.abs(p.x - s.x), nh = Math.abs(p.y - s.y);
        if (tool === 'callout') setCur(v => v ? { ...v, x: nx, y: ny, w: nw, h: nh, tailX: nx + nw * 0.3, tailY: ny + nh + Math.max(30, nh * 0.5) } : null);
        else setCur(v => v ? { ...v, x: nx, y: ny, w: nw, h: nh } : null);
      }
    }
  };

  const onUp = () => {
    if (panning) { setPanning(false); panStartRef.current = null; return; }
    if (polyRef.current) return;
    const mode = modeRef.current;
    if (mode === 'marquee') setMarquee(null);
    if (mode === 'groupDrag' || mode === 'resize') commit(objs);
    if (mode === 'draw' && cur) {
      let final: DiagramObject = cur;
      if (cur.type === 'freehand') {
        if ((cur.points?.length ?? 0) < 2) { setCur(null); activeRef.current = false; modeRef.current = 'idle'; return; }
        final = { ...cur, points: simplify(cur.points ?? [], 2) };
      } else {
        if ((cur.w ?? 0) < 5 && (cur.h ?? 0) < 5) { setCur(null); activeRef.current = false; modeRef.current = 'idle'; return; }
      }
      if (final.type === 'callout') { commit([...objs, final]); setEditText(final.id); setSel(new Set([final.id])); }
      else { commit([...objs, final]); }
      setCur(null);
    }
    activeRef.current = false; modeRef.current = 'idle'; startRef.current = null; groupStartRef.current = null; resRef.current = null;
  };

  const onDblClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (polyRef.current) { finishPoly(); return; }
    if (tool === 'select' && sel.size === 1) {
      const obj = objs.find(o => sel.has(o.id));
      if (obj?.type === 'polyline' && obj.points?.length && obj.points.length >= 2) {
        const p2 = ptFn(e), last = obj.points[obj.points.length - 1], first = obj.points[0];
        if (dist(p2, last) < 15 / zoom) { extendPoly(obj, true); return; }
        if (dist(p2, first) < 15 / zoom) { extendPoly(obj, false); return; }
      }
      if (obj?.type === 'text' || obj?.type === 'callout') { setEditText(obj.id); return; }
    }
  };

  const onWheelCb = useCallback((e: WheelEvent) => { e.preventDefault(); setZoom(v => Math.max(0.15, Math.min(4, v + (e.deltaY > 0 ? -0.1 : 0.1)))); }, []);
  useEffect(() => { const el = svgRef.current; if (!el) return; el.addEventListener('wheel', onWheelCb, { passive: false }); return () => el.removeEventListener('wheel', onWheelCb); }, [onWheelCb]);

  /* ─── Actions ─── */
  const delSel = () => { if (!sel.size) return; commit(objs.filter(o => !sel.has(o.id))); setSel(new Set()); };
  const copySel = useCallback(() => { setClip(objs.filter(o => sel.has(o.id))); }, [sel, objs]);
  const paste = useCallback(() => {
    if (!clip?.length) return;
    const pasted = clip.map(o => { const p2: DiagramObject = { ...o, id: uid(), x: o.x + 20, y: o.y + 20 }; if (p2.x2 !== undefined) p2.x2 = (o.x2 ?? 0) + 20; if (p2.y2 !== undefined) p2.y2 = (o.y2 ?? 0) + 20; if (p2.points) p2.points = o.points!.map(q => ({ x: q.x + 20, y: q.y + 20 })); if (p2.tailX !== undefined) { p2.tailX = (o.tailX ?? 0) + 20; p2.tailY = (o.tailY ?? 0) + 20; } return p2; });
    commit([...objs, ...pasted]); setSel(new Set(pasted.map(o => o.id))); setClip(pasted);
  }, [clip, objs, commit]);

  const exportPng = () => {
    const svg = svgRef.current; if (!svg) return;
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('viewBox', `0 0 ${CW} ${CH}`); clone.removeAttribute('style');
    clone.setAttribute('width', String(CW * 2)); clone.setAttribute('height', String(CH * 2));
    const data = new XMLSerializer().serializeToString(clone);
    const cvs = document.createElement('canvas'); cvs.width = CW * 2; cvs.height = CH * 2;
    const ctx = cvs.getContext('2d')!, img = new Image();
    img.onload = () => { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, CW * 2, CH * 2); ctx.drawImage(img, 0, 0); const a = document.createElement('a'); a.download = '구성도.png'; a.href = cvs.toDataURL('image/png'); a.click(); };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(data)));
  };

  const importImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string; if (!dataUrl) return;
      const img = new Image();
      img.onload = () => {
        const maxW = CW - 40, maxH = CH - 40;
        const scale = Math.min(maxW / img.width, maxH / img.height, 1);
        const w = img.width * scale, h = img.height * scale;
        commit([...objs, { id: uid(), type: 'rect', x: 20, y: 20, w, h, stroke: 'transparent', fill: 'transparent', strokeWidth: 0, text: dataUrl }]);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  /* ─── Keyboard handler ─── */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { if (polyRef.current) { finishPoly(); e.preventDefault(); } else setSel(new Set()); return; }
      if (e.key === 'Enter' && !editText && polyRef.current) { finishPoly(); e.preventDefault(); return; }
      if (e.key === 'Backspace' && polyRef.current) { setPolyPts(v => { if (v.length <= 1) { polyRef.current = false; return []; } return v.slice(0, -1); }); e.preventDefault(); return; }
      if ((e.key === 'Delete' || e.key === 'Backspace') && !editText && !polyRef.current) delSel();
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'a' && !editText) { e.preventDefault(); setSel(new Set(objs.map(o => o.id))); }
        if (e.key === 'z') { e.preventDefault(); undo(); }
        if (e.key === 'y') { e.preventDefault(); redo(); }
        if (e.key === 'c' && !editText) { e.preventDefault(); copySel(); }
        if (e.key === 'v' && !editText) { e.preventDefault(); paste(); }
      }
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  });

  const pickTool = (id: Tool) => { if (polyRef.current) finishPoly(); setTool(id); setLegend(null); };
  const pickLegend = (item: LegendItem) => {
    if (polyRef.current) finishPoly();
    if (legend === item.label) { setLegend(null); setTool('select'); return; }
    setLegend(item.label);
    if (item.stampText) {
      // 스탬프는 callout 도구로 설정하되 클릭시 바로 배치
      setTool('callout');
    } else {
      setTool(item.shape);
    }
    setStroke(item.stroke); setFill(item.fill); setSw(item.sw);
  };

  /* ─── Render Object ─── */
  const renderObj = (o: DiagramObject, preview = false) => {
    const isSel = sel.has(o.id) && !preview;
    const sp = isSel ? { strokeDasharray: '4 2' } : {};
    switch (o.type) {
      case 'rect':
        if (o.text?.startsWith('data:image')) return <g key={o.id}><image href={o.text} x={o.x} y={o.y} width={o.w} height={o.h} preserveAspectRatio="xMidYMid meet" /></g>;
        return <rect key={o.id} x={o.x} y={o.y} width={o.w} height={o.h} fill={o.fill} stroke={o.stroke} strokeWidth={o.strokeWidth} rx={2} {...sp} />;
      case 'ellipse':
        return <ellipse key={o.id} cx={o.x + (o.w ?? 0) / 2} cy={o.y + (o.h ?? 0) / 2} rx={(o.w ?? 0) / 2} ry={(o.h ?? 0) / 2} fill={o.fill} stroke={o.stroke} strokeWidth={o.strokeWidth} {...sp} />;
      case 'line':
        return <line key={o.id} x1={o.x} y1={o.y} x2={o.x2} y2={o.y2} stroke={o.stroke} strokeWidth={o.strokeWidth} {...sp} />;
      case 'arrow': {
        const mid = `arr-${o.id}`;
        return <g key={o.id}><defs><marker id={mid} markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto"><polygon points="0 0,10 3.5,0 7" fill={o.stroke} /></marker></defs><line x1={o.x} y1={o.y} x2={o.x2} y2={o.y2} stroke={o.stroke} strokeWidth={o.strokeWidth} markerEnd={`url(#${mid})`} {...sp} /></g>;
      }
      case 'callout': {
        const pathD = calloutPath(o);
        const tx = o.tailX ?? (o.x + (o.w ?? 0) * 0.3), ty = o.tailY ?? (o.y + (o.h ?? 0) + 30);
        const isEditing = editText === o.id, fs = o.fontSize ?? 14;
        const lines = (o.text || '').split('\n');
        return (<g key={o.id}>
          <path d={pathD} fill={o.fill || '#fffde7'} stroke={o.stroke} strokeWidth={o.strokeWidth} strokeLinejoin="round" {...sp} />
          {isEditing ? (
            <foreignObject x={o.x + 4} y={o.y + 3} width={(o.w ?? 120) - 8} height={(o.h ?? 60) - 6}>
              <textarea autoFocus style={{ width: '100%', height: '100%', border: 'none', outline: 'none', background: 'transparent', fontSize: fs, fontWeight: 500, color: o.stroke, resize: 'none', fontFamily: 'inherit', lineHeight: 1.3, padding: 2 }}
                value={o.text ?? ''} onChange={ev => setObjs(p => p.map(ob => ob.id === o.id ? { ...ob, text: ev.target.value } : ob))}
                onBlur={() => { setEditText(null); commit(objs); }} onKeyDown={ev => { if (ev.key === 'Escape') { setEditText(null); commit(objs); } }} />
            </foreignObject>
          ) : (lines.map((line, li) => (
            <text key={li} x={o.x + 8} y={o.y + fs + 4 + li * (fs + 2)} fill={o.stroke} fontSize={fs} fontWeight="500" fontFamily="'Pretendard','Noto Sans KR',sans-serif" style={{ userSelect: 'none', pointerEvents: 'none' }}>{line || (li === 0 ? '텍스트 입력' : '')}</text>
          )))}
          {isSel && <><circle cx={tx} cy={ty} r={5} fill="#f59e0b" stroke="#fff" strokeWidth={1.5} style={{ cursor: 'move' }} /><line x1={o.x + (o.w ?? 0) / 2} y1={ty >= (o.y + (o.h ?? 0) / 2) ? o.y + (o.h ?? 0) : o.y} x2={tx} y2={ty} stroke="#f59e0b" strokeWidth={0.8} strokeDasharray="3 2" opacity={0.5} />
            {/* flip button */}
            <g style={{ cursor: 'pointer' }} onClick={(ev) => { ev.stopPropagation(); const h2 = o.h ?? 60; const midY2 = o.y + h2 / 2; const curTy = o.tailY ?? (o.y + h2 + 30); const tailDist = Math.abs(curTy - (curTy >= midY2 ? (o.y + h2) : o.y)); const newTy = curTy >= midY2 ? o.y - tailDist : o.y + h2 + tailDist; setObjs(prev => prev.map(ob => ob.id === o.id ? { ...ob, tailY: newTy } : ob)); commit(objs.map(ob => ob.id === o.id ? { ...ob, tailY: newTy } : ob)); }}>
              <rect x={o.x + (o.w ?? 0) + 4} y={o.y - 2} width={20} height={20} rx={4} fill="#334155" stroke="#64748b" strokeWidth={0.8} />
              <text x={o.x + (o.w ?? 0) + 14} y={o.y + 13} fill="#f59e0b" fontSize={14} fontWeight="700" textAnchor="middle" style={{ userSelect: 'none', pointerEvents: 'none' }}>⇅</text>
            </g>
          </>}
        </g>);
      }
      case 'polyline': {
        if (!o.points || o.points.length < 2) return null;
        const d = o.points.map((p2, i) => `${i ? 'L' : 'M'}${p2.x},${p2.y}`).join(' ');
        return <g key={o.id}><path d={d} fill="none" stroke={o.stroke} strokeWidth={o.strokeWidth} strokeLinecap="round" strokeLinejoin="round" {...sp} />{isSel && o.points.map((p2, i) => <circle key={i} cx={p2.x} cy={p2.y} r={3.5} fill={i === 0 || i === o.points!.length - 1 ? '#2563eb' : '#93c5fd'} stroke="#fff" strokeWidth={1.2} />)}</g>;
      }
      case 'text':
        if (editText === o.id)
          return <foreignObject key={o.id} x={o.x} y={o.y - (o.fontSize ?? 14) - 2} width="320" height={(o.fontSize ?? 14) + 10}>
            <input autoFocus style={{ border: 'none', outline: '2px solid #2563eb', borderRadius: 3, background: '#fefce8', padding: '1px 6px', fontSize: o.fontSize ?? 14, fontWeight: 600, color: o.stroke, width: '100%', fontFamily: 'inherit' }}
              value={o.text ?? ''} onChange={ev => setObjs(p => p.map(ob => ob.id === o.id ? { ...ob, text: ev.target.value } : ob))}
              onBlur={() => { setEditText(null); commit(objs); }} onKeyDown={ev => { if (ev.key === 'Enter') { setEditText(null); commit(objs); } }} />
          </foreignObject>;
        return <text key={o.id} x={o.x} y={o.y} fill={o.stroke} fontSize={o.fontSize ?? 14} fontWeight="600" fontFamily="'Pretendard','Noto Sans KR',sans-serif"
          onDoubleClick={() => { setEditText(o.id); setSel(new Set([o.id])); }} style={{ cursor: 'text', userSelect: 'none' }} {...sp}>{o.text || '텍스트'}</text>;
      case 'stamp': {
        const w = o.w ?? STAMP_W, h = o.h ?? STAMP_H, fs = o.fontSize ?? 14, r = Math.min(6, w / 4, h / 4);
        const isEditing = editText === o.id;
        return (<g key={o.id}>
          <rect x={o.x} y={o.y} width={w} height={h} rx={r} ry={r} fill={o.fill || '#ffffff'} stroke={o.stroke} strokeWidth={o.strokeWidth} {...sp} />
          {isEditing ? (
            <foreignObject x={o.x + 2} y={o.y + 2} width={w - 4} height={h - 4}>
              <input autoFocus style={{ width: '100%', height: '100%', border: 'none', outline: 'none', background: 'transparent', fontSize: fs, fontWeight: 700, color: o.stroke, textAlign: 'center', fontFamily: 'inherit', padding: 0 }}
                value={o.text ?? ''} onChange={ev => setObjs(p => p.map(ob => ob.id === o.id ? { ...ob, text: ev.target.value } : ob))}
                onBlur={() => { setEditText(null); commit(objs); }} onKeyDown={ev => { if (ev.key === 'Enter' || ev.key === 'Escape') { setEditText(null); commit(objs); } }} />
            </foreignObject>
          ) : (
            <text x={o.x + w / 2} y={o.y + h / 2 + fs * 0.35} fill={o.stroke} fontSize={fs} fontWeight="700" fontFamily="'Pretendard','Noto Sans KR',sans-serif" textAnchor="middle"
              onDoubleClick={() => { setEditText(o.id); setSel(new Set([o.id])); }}
              style={{ cursor: 'text', userSelect: 'none' }}>{o.text}</text>
          )}
        </g>);
      }
      case 'freehand': {
        if (!o.points || o.points.length < 2) return null;
        const d = o.points.map((p2, i) => `${i ? 'L' : 'M'}${p2.x},${p2.y}`).join(' ');
        return <path key={o.id} d={d} fill="none" stroke={o.stroke} strokeWidth={o.strokeWidth} strokeLinecap="round" strokeLinejoin="round" {...sp} />;
      }
    }
  };

  /* ─── Derived ─── */
  const singleObj = sel.size === 1 ? objs.find(o => sel.has(o.id)) : null;
  const isPoly = tool === 'polyline' || tool === 'line' || tool === 'arrow';
  const polyPath = polyRef.current && polyPts.length > 0 ? [...polyPts, ...(polyPreview ? [polyPreview] : [])].map((p2, i) => `${i ? 'L' : 'M'}${p2.x},${p2.y}`).join(' ') : null;
  const mqR = marquee ? { x: Math.min(marquee.x1, marquee.x2), y: Math.min(marquee.y1, marquee.y2), w: Math.abs(marquee.x2 - marquee.x1), h: Math.abs(marquee.y2 - marquee.y1) } : null;
  const typeLabel = (t: string) => ({ rect: '사각형', ellipse: '원', callout: '설명선', stamp: '스탬프', polyline: '연결선', line: '직선', arrow: '화살표', text: '텍스트', freehand: '자유선' } as Record<string, string>)[t] || t;
  const ib: React.CSSProperties = { padding: 5, borderRadius: 4, border: 'none', cursor: 'pointer', background: 'transparent', color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center' };

  const TOOLS: ({ id: Tool; icon: React.ReactNode; l: string } | null)[] = [
    { id: 'select', icon: <MousePointer2 size={15} />, l: '선택' },
    { id: 'pan', icon: <Move size={15} />, l: '이동' },
    null,
    { id: 'rect', icon: <Square size={15} />, l: '사각형' },
    { id: 'ellipse', icon: <Circle size={15} />, l: '원' },
    { id: 'callout', icon: <MessageSquare size={15} />, l: '설명선' },
    null,
    { id: 'polyline', icon: <Spline size={15} />, l: '연결선' },
    { id: 'line', icon: <Minus size={15} />, l: '직선' },
    { id: 'arrow', icon: <ArrowRight size={15} />, l: '화살표' },
    null,
    { id: 'text', icon: <Type size={15} />, l: '텍스트' },
    { id: 'freehand', icon: <Palette size={15} />, l: '자유선' },
    { id: 'eraser', icon: <Eraser size={15} />, l: '지우개' },
  ];

  /* ─── JSX ─── */
  return (
    <div style={{ display: 'flex', height: 700, fontFamily: "'Pretendard','Noto Sans KR',system-ui,sans-serif", background: '#0f172a', color: '#e2e8f0', overflow: 'hidden', fontSize: 13, borderRadius: 8 }}>
      {/* SIDEBAR */}
      <div style={{ width: 52, background: '#1e293b', borderRight: '1px solid #334155', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 8, gap: 2, flexShrink: 0 }}>
        {TOOLS.map((t, i) => t === null
          ? <div key={i} style={{ width: 28, height: 1, background: '#334155', margin: '4px 0' }} />
          : <button key={t.id} title={t.l} onClick={() => pickTool(t.id)}
            style={{ width: 38, height: 34, borderRadius: 6, border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1, background: tool === t.id && !legend ? '#3b82f6' : 'transparent', color: tool === t.id && !legend ? '#fff' : '#94a3b8', fontSize: 9, fontWeight: 500, transition: 'all .15s' }}
            onMouseEnter={ev => { if (tool !== t.id || legend) ev.currentTarget.style.background = '#334155'; }}
            onMouseLeave={ev => { ev.currentTarget.style.background = tool === t.id && !legend ? '#3b82f6' : 'transparent'; }}
          >{t.icon}<span>{t.l}</span></button>
        )}
      </div>

      {/* CENTER */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* TOP BAR */}
        <div style={{ height: 48, background: '#1e293b', borderBottom: '1px solid #334155', display: 'flex', alignItems: 'center', gap: 4, padding: '0 12px', flexShrink: 0, overflowX: 'auto' }}>
          <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, marginRight: 2, whiteSpace: 'nowrap', flexShrink: 0 }}>선</span>
          {PALETTE.map(c => <button key={c.id} onClick={() => changeStroke(c.c)} style={{ width: 22, height: 22, borderRadius: 4, border: stroke === c.c ? '2.5px solid #60a5fa' : '2px solid #475569', background: c.c, cursor: 'pointer', transform: stroke === c.c ? 'scale(1.15)' : 'none', transition: 'transform .1s', flexShrink: 0 }} />)}
          <div style={{ width: 1, height: 24, background: '#334155', margin: '0 8px', flexShrink: 0 }} />
          <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, marginRight: 2, whiteSpace: 'nowrap', flexShrink: 0 }}>채우기</span>
          <button onClick={() => changeFill('transparent')} style={{ width: 22, height: 22, borderRadius: 4, border: fill === 'transparent' ? '2.5px solid #60a5fa' : '2px solid #475569', background: 'repeating-conic-gradient(#475569 0% 25%, #1e293b 0% 50%) 50%/6px 6px', cursor: 'pointer', flexShrink: 0 }} />
          {PALETTE.map(c => <button key={c.id} onClick={() => changeFill(c.c)} style={{ width: 22, height: 22, borderRadius: 4, border: fill === c.c ? '2.5px solid #60a5fa' : '2px solid #475569', background: c.c, cursor: 'pointer', transform: fill === c.c ? 'scale(1.15)' : 'none', transition: 'transform .1s', flexShrink: 0 }} />)}
          <div style={{ width: 1, height: 24, background: '#334155', margin: '0 8px', flexShrink: 0 }} />
          <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, marginRight: 2, whiteSpace: 'nowrap', flexShrink: 0 }}>굵기</span>
          <select value={sw} onChange={e => changeSw(+e.target.value)} style={{ background: '#0f172a', border: '1px solid #475569', borderRadius: 4, color: '#e2e8f0', padding: '3px 6px', fontSize: 12, height: 28, flexShrink: 0 }}>{WIDTHS.map(w => <option key={w} value={w}>{w}px</option>)}</select>
          <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, marginLeft: 6, marginRight: 2, whiteSpace: 'nowrap', flexShrink: 0 }}>글자</span>
          <select value={fontSize} onChange={e => changeFontSize(+e.target.value)} style={{ background: '#0f172a', border: '1px solid #475569', borderRadius: 4, color: '#e2e8f0', padding: '3px 6px', fontSize: 12, height: 28, flexShrink: 0 }}>{[10, 12, 14, 16, 18, 20, 24, 28, 32, 40].map(s => <option key={s} value={s}>{s}px</option>)}</select>
          <div style={{ width: 1, height: 24, background: '#334155', margin: '0 8px', flexShrink: 0 }} />
          <button onClick={undo} disabled={hIdx <= 0} style={{ ...ib, opacity: hIdx <= 0 ? .3 : 1, width: 32, height: 32 }}><Undo2 size={16} /></button>
          <button onClick={redo} disabled={hIdx >= hist.length - 1} style={{ ...ib, opacity: hIdx >= hist.length - 1 ? .3 : 1, width: 32, height: 32 }}><Redo2 size={16} /></button>
          <div style={{ width: 1, height: 24, background: '#334155', margin: '0 6px', flexShrink: 0 }} />
          <button onClick={copySel} disabled={!sel.size} style={{ ...ib, opacity: !sel.size ? .3 : 1, width: 32, height: 32 }}><Copy size={16} /></button>
          <button onClick={paste} disabled={!clip?.length} style={{ ...ib, opacity: !clip?.length ? .3 : 1, width: 32, height: 32 }}><ClipboardPaste size={16} /></button>
          <button onClick={delSel} disabled={!sel.size} style={{ ...ib, opacity: !sel.size ? .3 : 1, width: 32, height: 32 }}><Trash2 size={16} /></button>
          <button onClick={() => { commit([]); setSel(new Set()); }} style={{ ...ib, color: '#f87171', width: 32, height: 32 }}><Trash2 size={16} /></button>
          <div style={{ flex: 1 }} />
          <label style={{ ...ib, gap: 4, fontSize: 11, padding: '5px 12px', background: '#334155', borderRadius: 5, cursor: 'pointer', height: 32, fontWeight: 500, whiteSpace: 'nowrap', flexShrink: 0 }}>
            <Upload size={14} />이미지
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={importImage} />
          </label>
          <button onClick={exportPng} style={{ ...ib, gap: 4, fontSize: 11, padding: '5px 12px', background: '#334155', borderRadius: 5, height: 32, fontWeight: 500, whiteSpace: 'nowrap', flexShrink: 0 }}><Download size={14} />PNG</button>
          <button onClick={async () => {
            const d: DiagramData = { objects: objs, canvasWidth: CW, canvasHeight: CH };
            const w2 = d.canvasWidth || CW, h2 = d.canvasHeight || CH;
            const body2 = d.objects!.map(o => objToSvg(o)).join('') + buildLegendSvg(w2, legendItems, stampItems);
            const svgStr2 = `<svg xmlns="http://www.w3.org/2000/svg" width="${w2 * 2}" height="${h2 * 2}" viewBox="0 0 ${w2} ${h2}">${body2}</svg>`;
            const b64 = await new Promise<string | null>(resolve => {
              const cvs2 = document.createElement('canvas'); cvs2.width = w2 * 2; cvs2.height = h2 * 2;
              const ctx2 = cvs2.getContext('2d')!; const img2 = new Image();
              img2.onload = () => { ctx2.fillStyle = '#fff'; ctx2.fillRect(0, 0, w2 * 2, h2 * 2); ctx2.drawImage(img2, 0, 0); resolve(cvs2.toDataURL('image/png').split(',')[1]); };
              img2.onerror = () => resolve(null);
              img2.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgStr2)));
            });
            if (b64) { saveToParent(objs, { savedImage: b64 }); alert('구성도가 저장되었습니다.\n엑셀 내보내기 시 적용됩니다.'); }
          }} style={{ ...ib, gap: 4, fontSize: 11, padding: '5px 12px', background: '#16a34a', color: '#fff', borderRadius: 5, height: 32, fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 }}><Save size={14} />저장</button>
          <div style={{ width: 1, height: 24, background: '#334155', margin: '0 6px', flexShrink: 0 }} />
          <button onClick={() => setZoom(v => Math.max(.15, v - .15))} style={{ ...ib, width: 30, height: 30 }}><ZoomOut size={15} /></button>
          <span style={{ fontSize: 11, color: '#94a3b8', minWidth: 40, textAlign: 'center', fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 }}>{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(v => Math.min(4, v + .15))} style={{ ...ib, width: 30, height: 30 }}><ZoomIn size={15} /></button>
          <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} style={{ ...ib, fontSize: 11, padding: '4px 10px', fontWeight: 500, whiteSpace: 'nowrap', flexShrink: 0 }}>맞춤</button>
        </div>

        {/* STATUS BAR */}
        {(polyRef.current || sel.size > 1 || singleObj) && (
          <div style={{ height: 32, background: '#1e293b', borderBottom: '1px solid #334155', display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', fontSize: 11 }}>
            {polyRef.current && <><Spline size={12} style={{ color: '#60a5fa' }} /><span style={{ color: '#93c5fd', fontWeight: 600 }}>연결선 — {polyPts.length}점</span><span style={{ color: '#64748b' }}>클릭=점 | 더블클릭=완료 | ESC=취소</span></>}
            {!polyRef.current && sel.size > 1 && <><span style={{ color: '#fbbf24', fontWeight: 600 }}>{sel.size}개 선택</span><span style={{ color: '#64748b' }}>드래그=이동 | Delete=삭제</span></>}
            {!polyRef.current && singleObj && <>
              <span style={{ fontWeight: 600, color: '#93c5fd' }}>{typeLabel(singleObj.type)}</span>
              {singleObj.type === 'polyline' && <button onClick={() => extendPoly(singleObj, true)} style={{ display: 'flex', alignItems: 'center', gap: 3, border: '1px solid #3b82f6', background: '#1e3a5f', borderRadius: 4, padding: '1px 8px', cursor: 'pointer', fontSize: 10, color: '#93c5fd' }}><CornerDownRight size={11} />연장</button>}
              {(singleObj.type === 'text' || singleObj.type === 'callout') && <button onClick={() => setEditText(singleObj.id)} style={{ border: 'none', background: 'none', color: '#60a5fa', textDecoration: 'underline', cursor: 'pointer', fontSize: 11 }}>편집</button>}
              {singleObj.type === 'callout' && <span style={{ color: '#64748b', fontSize: 10 }}>노란●=꼬리이동</span>}
              <span style={{ color: '#475569' }}>|</span><span style={{ color: '#64748b' }}>색:</span>
              {PALETTE.map(c => <button key={c.id} onClick={() => commit(objs.map(o => sel.has(o.id) ? { ...o, stroke: c.c } : o))} style={{ width: 14, height: 14, borderRadius: 2, border: singleObj.stroke === c.c ? '2px solid #60a5fa' : '1px solid #475569', background: c.c, cursor: 'pointer' }} />)}
            </>}
          </div>
        )}

        {/* CANVAS */}
        <div style={{ flex: 1, background: '#e2e8f0', overflow: 'hidden', position: 'relative', cursor: tool === 'pan' || panning ? 'grab' : tool === 'select' ? 'default' : 'crosshair' }}>
          <svg ref={svgRef} width="100%" height="100%" viewBox={`0 0 ${CW} ${CH}`}
            style={{ transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom})`, transformOrigin: '0 0' }}
            onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp}
            onPointerLeave={() => { if (!polyRef.current) onUp(); }}
            onDoubleClick={onDblClick}>
            <defs>
              <pattern id="g1" width="50" height="50" patternUnits="userSpaceOnUse"><path d="M 50 0 L 0 0 0 50" fill="none" stroke="#e5e7eb" strokeWidth=".5" /></pattern>
              <pattern id="g2" width="250" height="250" patternUnits="userSpaceOnUse"><path d="M 250 0 L 0 0 0 250" fill="none" stroke="#d1d5db" strokeWidth="1" /></pattern>
            </defs>
            <rect width={CW} height={CH} fill="#ffffff" /><rect width={CW} height={CH} fill="url(#g1)" /><rect width={CW} height={CH} fill="url(#g2)" />
            {objs.map(o => renderObj(o))}
            {cur && renderObj(cur, true)}
            {polyPath && polyPts.length > 0 && <g>
              <path d={polyPath} fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeDasharray="8 4" opacity={.65} />
              {polyPts.map((p2, i) => <circle key={i} cx={p2.x} cy={p2.y} r={4} fill={i === 0 ? '#3b82f6' : '#60a5fa'} stroke="#fff" strokeWidth={1.5} />)}
              {polyPreview && <circle cx={polyPreview.x} cy={polyPreview.y} r={3} fill="#93c5fd" stroke="#fff" strokeWidth={1} opacity={.5} />}
            </g>}
            {snap && isPoly && <g>
              <circle cx={snap.x} cy={snap.y} r={8} fill="none" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="3 2" opacity={.8}><animate attributeName="r" values="5;9;5" dur="1s" repeatCount="indefinite" /></circle>
              <circle cx={snap.x} cy={snap.y} r={2.5} fill="#f59e0b" opacity={.9} />
            </g>}
            {mqR && mqR.w > 1 && mqR.h > 1 && <rect x={mqR.x} y={mqR.y} width={mqR.w} height={mqR.h} fill="rgba(59,130,246,.1)" stroke="#3b82f6" strokeWidth={1} strokeDasharray="6 3" />}
            {singleObj && (singleObj.type === 'rect' || singleObj.type === 'ellipse' || singleObj.type === 'callout') && <g>
              <rect x={singleObj.x - 2} y={singleObj.y - 2} width={(singleObj.w ?? 0) + 4} height={(singleObj.h ?? 0) + 4} fill="none" stroke="#3b82f6" strokeWidth={.8} strokeDasharray="4 2" />
              {getHandles(singleObj).map(h => <rect key={h.id} x={h.x - 4} y={h.y - 4} width={8} height={8} fill="#fff" stroke="#3b82f6" strokeWidth={1.5} rx={1.5} style={{ cursor: hCursor(h.id) }} />)}
            </g>}
            {singleObj && (singleObj.type === 'line' || singleObj.type === 'arrow') && <>
              <circle cx={singleObj.x} cy={singleObj.y} r={5} fill="#fff" stroke="#3b82f6" strokeWidth={1.5} />
              <circle cx={singleObj.x2} cy={singleObj.y2} r={5} fill="#fff" stroke="#3b82f6" strokeWidth={1.5} />
            </>}
            {sel.size > 1 && (() => {
              const so = objs.filter(o => sel.has(o.id));
              if (!so.length) return null;
              let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
              for (const o of so) { const bb = bbox(o); a = Math.min(a, bb.x1); b = Math.min(b, bb.y1); c = Math.max(c, bb.x2); d = Math.max(d, bb.y2); }
              return <rect x={a - 4} y={b - 4} width={c - a + 8} height={d - b + 8} fill="none" stroke="#fbbf24" strokeWidth={1.2} strokeDasharray="6 3" rx={3} />;
            })()}
          </svg>
        </div>

        {/* FOOTER */}
        <div style={{ height: 24, background: '#1e293b', borderTop: '1px solid #334155', display: 'flex', alignItems: 'center', padding: '0 12px', fontSize: 10, color: '#475569', gap: 16 }}>
          <span>드래그=영역선택</span><span>Shift+클릭=추가</span><span>Ctrl+A=전체</span><span>휠=확대축소</span><span>더블클릭=편집/연장</span>
          <span style={{ marginLeft: 'auto' }}>{CW}×{CH}</span><span>객체: {objs.length}</span>
        </div>
      </div>

      {/* LEGEND */}
      <div style={{ width: 148, background: '#1e293b', borderLeft: '1px solid #334155', display: 'flex', flexDirection: 'column', padding: 10, flexShrink: 0 }}>
        <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 13, color: '#e2e8f0', borderBottom: '1px solid #334155', paddingBottom: 8, marginBottom: 8, letterSpacing: 4 }}>범 례</div>
        {legendItems.map(item => (
          <button key={item.label} onClick={() => pickLegend(item)}
            onContextMenu={ev => { ev.preventDefault(); if (confirm(`범례 "${item.label}"을(를) 삭제하시겠습니까?`)) { setLegendItems(prev => prev.filter(i => i.label !== item.label)); if (legend === item.label) { setLegend(null); setTool('select'); } } }}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 11, textAlign: 'left', color: '#cbd5e1', background: legend === item.label ? '#1e3a5f' : 'transparent', outline: legend === item.label ? '1px solid #3b82f6' : 'none', transition: 'all .15s' }}
            onMouseEnter={ev => { if (legend !== item.label) ev.currentTarget.style.background = '#334155'; }}
            onMouseLeave={ev => { if (legend !== item.label) ev.currentTarget.style.background = 'transparent'; }}
          >
            {item.shape === 'polyline' ? (<svg width="22" height="10" style={{ flexShrink: 0 }}><line x1="0" y1="5" x2="22" y2="5" stroke={item.stroke} strokeWidth={item.sw} /></svg>) : (<svg width="14" height="12" style={{ flexShrink: 0 }}><rect x="1" y="1" width="12" height="10" fill={item.fill} stroke={item.stroke} strokeWidth={item.sw} rx={1} /></svg>)}
            <span>{item.label}</span>
          </button>
        ))}
        {/* 범례 추가 */}
        <button onClick={() => {
          const name = prompt('범례 이름을 입력하세요');
          if (!name?.trim()) return;
          const type = prompt('유형을 선택하세요 (1: 선, 2: 사각형)', '1');
          const color = prompt('색상코드 (#hex)', '#f97316');
          if (!color) return;
          const shape: Tool = type === '2' ? 'rect' : 'polyline';
          const newItem: LegendItem = { label: name.trim(), shape, stroke: color, fill: shape === 'rect' ? color : 'transparent', sw: shape === 'rect' ? 2 : 3 };
          setLegendItems(prev => [...prev, newItem]);
        }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '5px 8px', borderRadius: 6, border: '1px dashed #475569', cursor: 'pointer', fontSize: 10, color: '#64748b', background: 'transparent', marginTop: 4, transition: 'all .15s' }}
          onMouseEnter={ev => { ev.currentTarget.style.background = '#334155'; ev.currentTarget.style.color = '#94a3b8'; }}
          onMouseLeave={ev => { ev.currentTarget.style.background = 'transparent'; ev.currentTarget.style.color = '#64748b'; }}
        >+ 범례 추가</button>

        {legend && !stampItems.find(s => s.label === legend) && <p style={{ fontSize: 9, color: '#60a5fa', marginTop: 10, textAlign: 'center', lineHeight: 1.6 }}>클릭으로 점을 찍고<br />더블클릭으로 완료</p>}
        {legend && stampItems.find(s => s.label === legend) && <p style={{ fontSize: 9, color: '#60a5fa', marginTop: 10, textAlign: 'center', lineHeight: 1.6 }}>캔버스에 클릭하면<br />스탬프가 배치됩니다</p>}

        {/* EPS 스탬프 */}
        <div style={{ borderTop: '1px solid #334155', marginTop: 10, paddingTop: 8 }}>
          <div style={{ fontSize: 10, color: '#64748b', fontWeight: 600, marginBottom: 4 }}>스탬프</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
            {stampItems.map(item => (
              <button key={item.label} onClick={() => pickLegend(item)}
                onContextMenu={ev => { ev.preventDefault(); if (confirm(`스탬프 "${item.stampText}"을(를) 삭제하시겠습니까?`)) { setStampItems(prev => prev.filter(i => i.label !== item.label)); if (legend === item.label) { setLegend(null); setTool('select'); } } }}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '5px 4px', borderRadius: 5, border: legend === item.label ? '1.5px solid #3b82f6' : '1px solid #475569', cursor: 'pointer', fontSize: 10, fontWeight: 700, color: item.stroke, background: legend === item.label ? '#1e3a5f' : '#0f172a', transition: 'all .15s', whiteSpace: 'nowrap' }}
                onMouseEnter={ev => { if (legend !== item.label) ev.currentTarget.style.background = '#334155'; }}
                onMouseLeave={ev => { ev.currentTarget.style.background = legend === item.label ? '#1e3a5f' : '#0f172a'; }}
              >{item.stampText}</button>
            ))}
          </div>
          {/* 스탬프 추가 */}
          <button onClick={() => {
            const name = prompt('스탬프 텍스트를 입력하세요');
            if (!name?.trim()) return;
            const color = prompt('색상코드 (#hex)', '#f97316');
            if (!color) return;
            const newItem: LegendItem = { label: name.trim(), shape: 'callout', stroke: color, fill: '#ffffff', sw: 2, stampText: name.trim() };
            setStampItems(prev => [...prev, newItem]);
          }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, padding: '4px', borderRadius: 5, border: '1px dashed #475569', cursor: 'pointer', fontSize: 9, color: '#64748b', background: 'transparent', marginTop: 4, gridColumn: '1 / -1', transition: 'all .15s' }}
            onMouseEnter={ev => { ev.currentTarget.style.background = '#334155'; ev.currentTarget.style.color = '#94a3b8'; }}
            onMouseLeave={ev => { ev.currentTarget.style.background = 'transparent'; ev.currentTarget.style.color = '#64748b'; }}
          >+ 스탬프 추가</button>
        </div>
        <div style={{ marginTop: 'auto', borderTop: '1px solid #334155', paddingTop: 10 }}>
          <div style={{ fontSize: 9, color: '#475569', lineHeight: 1.7 }}>
            <div style={{ fontWeight: 600, color: '#64748b', marginBottom: 3 }}>단축키</div>
            <div>Ctrl+Z 실행취소</div><div>Ctrl+Y 다시실행</div><div>Ctrl+A 전체선택</div><div>Ctrl+C/V 복사/붙여넣기</div><div>ESC 선택해제</div><div>Delete 삭제</div>
          </div>
        </div>
      </div>
    </div>
  );
}
