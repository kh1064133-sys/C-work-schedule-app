'use client';

import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { Plus, Trash2, Printer, Upload, Image, X, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getStoredValue, setStoredValue } from '@/lib/storage';

/* ────────────────────────────── types ────────────────────────────── */
interface PhotoItem { src: string; }

interface PhotoPage {
  id: string;
  photos: (PhotoItem | null)[];       // length = 4
  rowTitles: [string, string];        // "사진설명" per row
  rowDescriptions: [string, string];  // "작업 내용" per row
  captions: [string, string, string, string];
}

interface DocState {
  docTitle: string;
  projectName: string;
  date: string;
  logo: string | null;
  logoPos: { x: number; y: number };
  logoSize: { w: number; h: number };
  titleBoxPos: { x: number; y: number };
  datePos: { x: number; y: number };
  pages: PhotoPage[];
}

const STORAGE_KEY = 'photodoc';

function newPage(): PhotoPage {
  return {
    id: crypto.randomUUID(),
    photos: [null, null, null, null],
    rowTitles: ['사진설명', '사진설명'],
    rowDescriptions: ['작업 내용', '작업 내용'],
    captions: ['사진 1', '사진 2', '사진 3', '사진 4'],
  };
}

/* 이전 버전 localStorage 데이터에 누락 필드 보완 */
function normalizePage(p: any): PhotoPage {
  return {
    id: p.id ?? crypto.randomUUID(),
    photos: p.photos ?? [null, null, null, null],
    rowTitles: p.rowTitles ?? ['사진설명', '사진설명'],
    rowDescriptions: p.rowDescriptions ?? ['작업 내용', '작업 내용'],
    captions: p.captions ?? ['사진 1', '사진 2', '사진 3', '사진 4'],
  };
}

function normalizeDoc(d: any): DocState {
  const def = defaultState();
  return {
    docTitle: d.docTitle ?? def.docTitle,
    projectName: d.projectName ?? def.projectName,
    date: d.date ?? def.date,
    logo: d.logo ?? null,
    logoPos: d.logoPos ?? def.logoPos,
    logoSize: d.logoSize ?? def.logoSize,
    titleBoxPos: d.titleBoxPos ?? def.titleBoxPos,
    datePos: d.datePos ?? def.datePos,
    pages: Array.isArray(d.pages) ? d.pages.map(normalizePage) : [newPage()],
  };
}

function defaultState(): DocState {
  const now = new Date();
  return {
    docTitle: '사 진 대 지',
    projectName: '◯◯◯ 공사',
    date: `${now.getFullYear()}년 ${now.getMonth() + 1}월`,
    logo: null,
    logoPos: { x: 250, y: 650 },
    logoSize: { w: 200, h: 80 },
    titleBoxPos: { x: 48, y: 280 },
    datePos: { x: 260, y: 560 },
    pages: [newPage()],
  };
}

/* ─────────────── Editable text (click to edit) ─────────────── */
function EditableText({ value, onChange, className, style, tag }: {
  value: string; onChange: (v: string) => void;
  className?: string; style?: React.CSSProperties; tag?: 'h1' | 'h2' | 'p' | 'span';
}) {
  const [editing, setEditing] = useState(false);
  const [tmp, setTmp] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setTmp(value); }, [value]);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  if (editing) {
    return (
      <input ref={inputRef} className={`bg-yellow-50 border-b-2 border-blue-400 outline-none text-center ${className || ''}`}
        style={{ ...style, width: '100%' }} value={tmp}
        onChange={e => setTmp(e.target.value)}
        onBlur={() => { setEditing(false); onChange(tmp); }}
        onKeyDown={e => { if (e.key === 'Enter') { setEditing(false); onChange(tmp); } }}
      />
    );
  }
  const Tag = tag || 'span';
  return <Tag className={`cursor-pointer hover:bg-yellow-50/50 transition-colors ${className || ''}`} style={style} onClick={() => setEditing(true)}>{value || '(클릭하여 입력)'}</Tag>;
}

/* ──────────────── Draggable + Resizable Logo ──────────────── */
function DraggableLogo({ src, pos, size, onChangePos, onChangeSize, onChangeSrc }: {
  src: string | null; pos: { x: number; y: number }; size: { w: number; h: number };
  onChangePos: (p: { x: number; y: number }) => void;
  onChangeSize: (s: { w: number; h: number }) => void;
  onChangeSrc: (s: string | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const resizeRef = useRef<{ startX: number; startY: number; origW: number; origH: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y };
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      onChangePos({ x: dragRef.current.origX + ev.clientX - dragRef.current.startX, y: dragRef.current.origY + ev.clientY - dragRef.current.startY });
    };
    const onUp = () => { dragRef.current = null; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const handleResizeDown = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    resizeRef.current = { startX: e.clientX, startY: e.clientY, origW: size.w, origH: size.h };
    const onMove = (ev: MouseEvent) => {
      if (!resizeRef.current) return;
      const dw = ev.clientX - resizeRef.current.startX;
      const dh = ev.clientY - resizeRef.current.startY;
      onChangeSize({ w: Math.max(60, resizeRef.current.origW + dw), h: Math.max(30, resizeRef.current.origH + dh) });
    };
    const onUp = () => { resizeRef.current = null; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onChangeSrc(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <div ref={containerRef} className="no-print-edit" style={{ position: 'absolute', left: pos.x, top: pos.y, width: size.w, height: size.h, cursor: 'move', border: '1px dashed #93c5fd', borderRadius: 4 }}
      onMouseDown={handleMouseDown} onDoubleClick={() => fileRef.current?.click()}>
      {src ? (
        <img src={src} alt="로고" style={{ width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' }} />
      ) : (
        <div className="flex items-center justify-center h-full text-xs text-gray-400 select-none" onClick={() => fileRef.current?.click()}>
          로고 이미지<br />더블클릭하여 변경
        </div>
      )}
      {/* Resize handle */}
      <div className="no-print-edit" style={{ position: 'absolute', right: -4, bottom: -4, width: 10, height: 10, background: '#3b82f6', cursor: 'se-resize', borderRadius: 2 }} onMouseDown={handleResizeDown} />
      <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
    </div>
  );
}

/* ──────────────── Draggable Box ──────────────── */
function DraggableBox({ pos, onChangePos, children, style }: {
  pos: { x: number; y: number };
  onChangePos: (p: { x: number; y: number }) => void;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    // EditableText 클릭 시 드래그 방지
    if ((e.target as HTMLElement).tagName === 'INPUT') return;
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y };
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      onChangePos({
        x: dragRef.current.origX + ev.clientX - dragRef.current.startX,
        y: dragRef.current.origY + ev.clientY - dragRef.current.startY,
      });
    };
    const onUp = () => { dragRef.current = null; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  return (
    <div style={{ position: 'absolute', left: pos.x, top: pos.y, cursor: 'move', ...style }} onMouseDown={handleMouseDown}>
      {children}
    </div>
  );
}

/* ══════════════════════ Cover Page ══════════════════════ */
function CoverPage({ doc, onChange }: { doc: DocState; onChange: (d: Partial<DocState>) => void }) {
  const titleBoxPos = doc.titleBoxPos ?? { x: 48, y: 280 };
  const datePos = doc.datePos ?? { x: 260, y: 560 };

  return (
    <div className="photo-page" style={{ width: 720, height: 960, position: 'relative', background: '#fff', margin: '0 auto 32px', boxShadow: '0 2px 16px rgba(0,0,0,.12)', fontFamily: '"Noto Sans KR", sans-serif', overflow: 'hidden' }}>
      {/* 타이틀 박스 (드래그 가능) */}
      <DraggableBox pos={titleBoxPos} onChangePos={p => onChange({ titleBoxPos: p })}
        style={{ width: 'calc(100% - 96px)' }}>
        <div style={{ border: '3px solid #2563eb', borderRadius: 4, padding: '48px 24px 44px', textAlign: 'center' }}>
          <EditableText value={doc.docTitle ?? '사 진 대 지'} onChange={v => onChange({ docTitle: v })} style={{ fontSize: 42, fontWeight: 700, letterSpacing: 20, color: '#1e3a5f', marginBottom: 28, display: 'block' }} tag="h1" />
          <EditableText value={doc.projectName} onChange={v => onChange({ projectName: v })} style={{ fontSize: 22, fontWeight: 600, color: '#333', display: 'block' }} />
        </div>
      </DraggableBox>
      {/* 날짜 (드래그 가능) */}
      <DraggableBox pos={datePos} onChangePos={p => onChange({ datePos: p })}>
        <div style={{ textAlign: 'center' }}>
          <EditableText value={doc.date} onChange={v => onChange({ date: v })} style={{ fontSize: 22, color: '#444' }} />
        </div>
      </DraggableBox>
      {/* 드래그 로고 */}
      <DraggableLogo src={doc.logo} pos={doc.logoPos} size={doc.logoSize}
        onChangePos={p => onChange({ logoPos: p })} onChangeSize={s => onChange({ logoSize: s })}
        onChangeSrc={s => onChange({ logo: s })} />
    </div>
  );
}

/* ══════════════════════ Photo Page ══════════════════════ */
function PhotoPageView({ page, doc, pageIndex, onPageChange, onDocChange }: {
  page: PhotoPage; doc: DocState; pageIndex: number;
  onPageChange: (p: Partial<PhotoPage>) => void;
  onDocChange: (d: Partial<DocState>) => void;
}) {
  const fileRefs = useRef<(HTMLInputElement | null)[]>([null, null, null, null]);
  const batchRef = useRef<HTMLInputElement>(null);

  const handlePhotoSelect = (idx: number, file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const newPhotos = [...page.photos] as (PhotoItem | null)[];
      newPhotos[idx] = { src: reader.result as string };
      onPageChange({ photos: newPhotos });
    };
    reader.readAsDataURL(file);
  };

  const handleBatchUpload = (files: FileList) => {
    const emptySlots = page.photos.map((p, i) => p === null ? i : -1).filter(i => i >= 0);
    const filesToProcess = Array.from(files).slice(0, emptySlots.length);
    filesToProcess.forEach((file, fi) => {
      const reader = new FileReader();
      reader.onload = () => {
        onPageChange({
          photos: page.photos.map((p, i) => i === emptySlots[fi] ? { src: reader.result as string } : p) as (PhotoItem | null)[],
        });
      };
      reader.readAsDataURL(file);
    });
  };

  const removePhoto = (idx: number) => {
    const newPhotos = [...page.photos] as (PhotoItem | null)[];
    newPhotos[idx] = null;
    onPageChange({ photos: newPhotos });
  };

  const renderPhotoCell = (idx: number) => {
    const photo = page.photos[idx];
    return (
      <div style={{ flex: 1, border: '1px solid #d1d5db', minHeight: 160, position: 'relative', background: '#fafafa', display: 'flex', flexDirection: 'column' }}>
        {photo ? (
          <>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: 4 }}>
              <img src={photo.src} alt="" style={{ maxWidth: '100%', maxHeight: 180, objectFit: 'contain' }} />
            </div>
            <button className="no-print-edit" style={{ position: 'absolute', top: 2, right: 2, background: '#ef4444', color: '#fff', border: 'none', borderRadius: '50%', width: 18, height: 18, fontSize: 10, cursor: 'pointer', lineHeight: '18px', textAlign: 'center' }}
              onClick={() => removePhoto(idx)}>✕</button>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#9ca3af', fontSize: 12 }}
            onClick={() => fileRefs.current[idx]?.click()}>
            <div style={{ textAlign: 'center' }}>
              <Image style={{ width: 24, height: 24, margin: '0 auto 4px', opacity: 0.4 }} />
              사진 클릭
            </div>
          </div>
        )}
        <input ref={el => { fileRefs.current[idx] = el; }} type="file" accept="image/*" style={{ display: 'none' }}
          onChange={e => { if (e.target.files?.[0]) { handlePhotoSelect(idx, e.target.files[0]); e.target.value = ''; } }} />
        {/* 캡션 */}
        <div style={{ borderTop: '1px solid #d1d5db', padding: '3px 4px', textAlign: 'center' }}>
          <EditableText value={page.captions[idx]} onChange={v => {
            const newCaptions = [...page.captions] as [string, string, string, string];
            newCaptions[idx] = v;
            onPageChange({ captions: newCaptions });
          }} style={{ fontSize: 10, color: '#555' }} />
        </div>
      </div>
    );
  };

  return (
    <div className="photo-page" style={{ width: 720, height: 960, position: 'relative', background: '#fff', margin: '0 auto 32px', boxShadow: '0 2px 16px rgba(0,0,0,.12)', fontFamily: '"Noto Sans KR", sans-serif', display: 'flex', flexDirection: 'column', padding: '80px 32px 40px' }}>
      {/* 헤더 */}
      <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 120px', border: '2px solid #333', marginBottom: 6 }}>
        <div style={{ borderRight: '1px solid #333', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 5, height: 80 }}>
          {doc.logo ? <img src={doc.logo} alt="로고" style={{ maxHeight: 70, maxWidth: 143, objectFit: 'contain' }} /> : <span style={{ fontSize: 10, color: '#aaa' }}>로고</span>}
        </div>
        <div style={{ borderRight: '1px solid #333', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 10 }}>
          <span style={{ fontWeight: 700, fontSize: 18 }}>{doc.projectName}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 10 }}>
          <span style={{ fontSize: 16, color: '#555' }}>{doc.date}</span>
        </div>
      </div>

      {/* 일괄등록 버튼 */}
      <div className="no-print-edit" style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
        <button style={{ fontSize: 11, padding: '2px 10px', border: '1px solid #93c5fd', borderRadius: 4, background: '#eff6ff', color: '#2563eb', cursor: 'pointer' }}
          onClick={() => batchRef.current?.click()}>
          📷 일괄등록
        </button>
        <input ref={batchRef} type="file" accept="image/*" multiple style={{ display: 'none' }}
          onChange={e => { if (e.target.files) handleBatchUpload(e.target.files); e.target.value = ''; }} />
      </div>

      {/* 상단 블록 (Row1 타이틀 + 사진 1,2) */}
      <div style={{ border: '2px solid #333', flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* 사진설명 행 */}
        <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', borderBottom: '2px solid #333' }}>
          <div style={{ borderRight: '2px solid #333', padding: '12px 6px', background: '#f0f4ff', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <EditableText value={page.rowTitles[0]} onChange={v => onPageChange({ rowTitles: [v, page.rowTitles[1]] as [string, string] })} style={{ fontSize: 12, fontWeight: 600 }} />
          </div>
          <div style={{ padding: '12px 10px', background: '#f0f4ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <EditableText value={page.rowDescriptions[0]} onChange={v => onPageChange({ rowDescriptions: [v, page.rowDescriptions[1]] as [string, string] })} style={{ fontSize: 12, fontWeight: 600, textAlign: 'center' }} />
          </div>
        </div>
        {/* 사진 행 */}
        <div style={{ display: 'flex', flex: 1 }}>
          {[0, 1].map(idx => {
            const photo = page.photos[idx];
            const aspectH = Math.round((page.photos[0] || page.photos[1]) ? 220 : 220);
            return (
              <div key={idx} style={{ borderRight: idx === 0 ? '2px solid #333' : undefined, display: 'flex', flexDirection: 'column', flex: 1 }}>
                <div style={{ position: 'relative', flex: 1, background: '#fafafa', overflow: 'hidden' }}>
                  {photo ? (
                    <>
                      <img src={photo.src} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                      <button className="no-print-edit" style={{ position: 'absolute', top: 2, right: 2, background: '#ef4444', color: '#fff', border: 'none', borderRadius: '50%', width: 18, height: 18, fontSize: 10, cursor: 'pointer', lineHeight: '18px', textAlign: 'center' }}
                        onClick={() => removePhoto(idx)}>✕</button>
                    </>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#9ca3af', fontSize: 12, cursor: 'pointer' }}
                      onClick={() => fileRefs.current[idx]?.click()}>
                      <Image style={{ width: 24, height: 24, marginBottom: 4, opacity: 0.4 }} />
                      사진 클릭
                    </div>
                  )}
                  <input ref={el => { fileRefs.current[idx] = el; }} type="file" accept="image/*" style={{ display: 'none' }}
                    onChange={e => { if (e.target.files?.[0]) { handlePhotoSelect(idx, e.target.files[0]); e.target.value = ''; } }} />
                </div>
                <div style={{ borderTop: '2px solid #333', padding: '3px 4px', textAlign: 'center', background: '#fff' }}>
                  <EditableText value={page.captions[idx]} onChange={v => {
                    const newCaptions = [...page.captions] as [string, string, string, string];
                    newCaptions[idx] = v;
                    onPageChange({ captions: newCaptions });
                  }} style={{ fontSize: 12, color: '#000' }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 하단 블록 (Row2 타이틀 + 사진 3,4) */}
      <div style={{ borderLeft: '2px solid #333', borderRight: '2px solid #333', borderBottom: '2px solid #333', flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* 사진설명 행 */}
        <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', borderBottom: '2px solid #333' }}>
          <div style={{ borderRight: '2px solid #333', padding: '12px 6px', background: '#f0f4ff', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <EditableText value={page.rowTitles[1]} onChange={v => onPageChange({ rowTitles: [page.rowTitles[0], v] as [string, string] })} style={{ fontSize: 12, fontWeight: 600 }} />
          </div>
          <div style={{ padding: '12px 10px', background: '#f0f4ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <EditableText value={page.rowDescriptions[1]} onChange={v => onPageChange({ rowDescriptions: [page.rowDescriptions[0], v] as [string, string] })} style={{ fontSize: 12, fontWeight: 600, textAlign: 'center' }} />
          </div>
        </div>
        {/* 사진 행 */}
        <div style={{ display: 'flex', flex: 1 }}>
          {[2, 3].map(idx => {
            const photo = page.photos[idx];
            return (
              <div key={idx} style={{ borderRight: idx === 2 ? '2px solid #333' : undefined, display: 'flex', flexDirection: 'column', flex: 1 }}>
                <div style={{ position: 'relative', flex: 1, background: '#fafafa', overflow: 'hidden' }}>
                  {photo ? (
                    <>
                      <img src={photo.src} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                      <button className="no-print-edit" style={{ position: 'absolute', top: 2, right: 2, background: '#ef4444', color: '#fff', border: 'none', borderRadius: '50%', width: 18, height: 18, fontSize: 10, cursor: 'pointer', lineHeight: '18px', textAlign: 'center' }}
                        onClick={() => removePhoto(idx)}>✕</button>
                    </>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#9ca3af', fontSize: 12, cursor: 'pointer' }}
                      onClick={() => fileRefs.current[idx]?.click()}>
                      <Image style={{ width: 24, height: 24, marginBottom: 4, opacity: 0.4 }} />
                      사진 클릭
                    </div>
                  )}
                  <input ref={el => { fileRefs.current[idx] = el; }} type="file" accept="image/*" style={{ display: 'none' }}
                    onChange={e => { if (e.target.files?.[0]) { handlePhotoSelect(idx, e.target.files[0]); e.target.value = ''; } }} />
                </div>
                <div style={{ borderTop: '2px solid #333', padding: '3px 4px', textAlign: 'center', background: '#fff' }}>
                  <EditableText value={page.captions[idx]} onChange={v => {
                    const newCaptions = [...page.captions] as [string, string, string, string];
                    newCaptions[idx] = v;
                    onPageChange({ captions: newCaptions });
                  }} style={{ fontSize: 12, color: '#000' }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 하단 로고 */}
      <div style={{ marginTop: 'auto', paddingTop: 8, textAlign: 'center' }}>
        {doc.logo && <img src={doc.logo} alt="로고" style={{ maxHeight: 32, objectFit: 'contain', opacity: 0.6 }} />}
      </div>

      {/* 페이지 번호 */}
      <div style={{ paddingTop: 25, textAlign: 'center', fontSize: 13, color: '#333' }}>
        {pageIndex + 1}
      </div>
    </div>
  );
}

/* ══════════════════════ Main Component ══════════════════════ */
export function PhotoDocPage() {
  const [doc, setDoc] = useState<DocState>(defaultState);
  const [loaded, setLoaded] = useState(false);

  // Load from localStorage
  useEffect(() => {
    const saved = getStoredValue<DocState | null>(STORAGE_KEY, null);
    if (saved) setDoc(normalizeDoc(saved));
    setLoaded(true);
  }, []);

  // Auto-save
  useEffect(() => {
    if (!loaded) return;
    const timer = setTimeout(() => setStoredValue(STORAGE_KEY, doc), 500);
    return () => clearTimeout(timer);
  }, [doc, loaded]);

  const updateDoc = useCallback((partial: Partial<DocState>) => {
    setDoc(prev => ({ ...prev, ...partial }));
  }, []);

  const updatePage = useCallback((pageId: string, partial: Partial<PhotoPage>) => {
    setDoc(prev => ({
      ...prev,
      pages: prev.pages.map(p => p.id === pageId ? { ...p, ...partial } : p),
    }));
  }, []);

  const addPage = () => setDoc(prev => ({ ...prev, pages: [...prev.pages, newPage()] }));
  const removePage = (id: string) => {
    if (!confirm('이 페이지를 삭제하시겠습니까?')) return;
    setDoc(prev => ({ ...prev, pages: prev.pages.filter(p => p.id !== id) }));
  };

  const handlePrint = () => window.print();

  return (
    <>
      {/* 인쇄 시 편집 UI 숨기는 스타일 */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;600;700&display=swap');
        @media print {
          .no-print, .no-print-edit { display: none !important; }
          .photo-page { box-shadow: none !important; margin: 0 !important; page-break-after: always; }
          body { margin: 0; padding: 0; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
      `}</style>

      {/* 컨트롤 바 */}
      <div className="no-print" style={{ position: 'sticky', top: 64, zIndex: 30, background: '#f8fafc', borderBottom: '1px solid #e2e8f0', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 700, fontSize: 16 }}>📷 사진대지</span>
        <span style={{ fontSize: 12, color: '#64748b' }}>표지 1장 + 사진 {doc.pages.length}장</span>
        <div style={{ flex: 1 }} />
        <Button variant="outline" size="sm" className="gap-1" onClick={addPage}>
          <Plus className="h-3.5 w-3.5" /> 페이지 추가
        </Button>
        <Button size="sm" className="gap-1 bg-blue-600 hover:bg-blue-700" onClick={handlePrint}>
          <Printer className="h-3.5 w-3.5" /> 인쇄 / PDF
        </Button>
      </div>

      {/* 페이지 영역 */}
      <div style={{ padding: '24px 0', background: '#e2e8f0', minHeight: '100vh' }}>
        {/* 표지 */}
        <CoverPage doc={doc} onChange={updateDoc} />

        {/* 사진 페이지들 */}
        {doc.pages.map((page, i) => (
          <div key={page.id} style={{ position: 'relative' }}>
            {/* 페이지 삭제 버튼 */}
            <div className="no-print" style={{ position: 'absolute', top: -12, right: 'calc(50% - 360px + 8px)', zIndex: 10 }}>
              <button style={{ fontSize: 11, padding: '2px 8px', border: '1px solid #fca5a5', borderRadius: 4, background: '#fef2f2', color: '#dc2626', cursor: 'pointer' }}
                onClick={() => removePage(page.id)}>
                <Trash2 style={{ width: 12, height: 12, display: 'inline', marginRight: 2 }} /> 삭제
              </button>
            </div>
            <PhotoPageView page={page} doc={doc} pageIndex={i}
              onPageChange={p => updatePage(page.id, p)}
              onDocChange={updateDoc} />
          </div>
        ))}
      </div>
    </>
  );
}
