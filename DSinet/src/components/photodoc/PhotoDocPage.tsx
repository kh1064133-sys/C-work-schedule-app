'use client';

import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { Plus, Trash2, Printer, Upload, Image, X, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getStoredValue, setStoredValue } from '@/lib/storage';

/* ────────────────────────────── types ────────────────────────────── */
interface PhotoItem { src: string; }

interface PhotoPage {
  id: string;
  photos: (PhotoItem | null)[];       // length = 4 (template1,3) or 2 (template2)
  rowTitles: [string, string];        // "사진설명" per row
  rowDescriptions: [string, string];  // "작업 내용" per row
  captions: [string, string, string, string];
  // Template 2 (건설공사 사진대지) 전용 필드
  workTypes?: [string, string];       // 공종
  subWorkTypes?: [string, string];    // 세부공종
  photoDates?: [string, string];      // 촬영일
  locations?: [string, string];       // 위치
  descriptions?: [string, string];    // 설명
  // Template 3 (작업사진첩) 전용 필드
  pageTitle?: string;                 // 페이지 제목 (예: "케이블 포설 작업")
  workNumber?: string;                // 번호
  workName?: string;                  // 작업명
  content?: string;                   // 내용
  photoLabels?: [string, string, string, string]; // 사진 라벨 (작업전, 작업중 등)
}

interface DocState {
  docTitle: string;
  projectName: string;
  date: string;
  companyName?: string;
  logo: string | null;
  logoPos: { x: number; y: number };
  logoSize: { w: number; h: number };
  titleBoxPos: { x: number; y: number };
  datePos: { x: number; y: number };
  pages: PhotoPage[];
  templateType?: number;  // 1 = 2x2 기본, 2 = 건설공사 사진대지
}

interface DocListItem {
  id: string;
  name: string;
  templateType?: number;
}

const STORAGE_KEY_PREFIX = 'photodoc_';
const DOC_LIST_KEY = 'photodoc_list';
// 기존 단일 문서 호환용
const LEGACY_STORAGE_KEY = 'photodoc';

// 이미지를 리사이즈하여 localStorage 용량 절약 (max 1200px, JPEG 70%)
function compressImage(file: File, maxSize = 1200, quality = 0.7): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new window.Image();
      img.onload = () => {
        let w = img.width, h = img.height;
        if (w > maxSize || h > maxSize) {
          if (w > h) { h = Math.round(h * maxSize / w); w = maxSize; }
          else { w = Math.round(w * maxSize / h); h = maxSize; }
        }
        const cvs = document.createElement('canvas');
        cvs.width = w; cvs.height = h;
        const ctx = cvs.getContext('2d')!;
        ctx.drawImage(img, 0, 0, w, h);
        resolve(cvs.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => resolve(reader.result as string); // 실패 시 원본
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

function newPage(): PhotoPage {
  return {
    id: crypto.randomUUID(),
    photos: [null, null, null, null],
    rowTitles: ['사진설명', '사진설명'],
    rowDescriptions: ['작업 내용', '작업 내용'],
    captions: ['사진 1', '사진 2', '사진 3', '사진 4'],
  };
}

function newPageT2(): PhotoPage {
  const now = new Date();
  return {
    id: crypto.randomUUID(),
    photos: [null, null],
    rowTitles: ['사진설명', '사진설명'],
    rowDescriptions: ['', ''],
    captions: ['사진 1', '사진 2', '', ''],
    workTypes: ['', ''],
    subWorkTypes: ['', ''],
    photoDates: [`${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`, `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`],
    locations: ['', ''],
    descriptions: ['작업 전', '작업 후'],
  };
}

function newPageT3(pageNum: number = 1): PhotoPage {
  return {
    id: crypto.randomUUID(),
    photos: [null, null, null, null],
    rowTitles: ['사진설명', '사진설명'],
    rowDescriptions: ['작업 내용', '작업 내용'],
    captions: ['사진 1', '사진 2', '사진 3', '사진 4'],
    pageTitle: '케이블 포설 작업',
    workNumber: String(pageNum),
    workName: '',
    content: '',
    photoLabels: ['작업전', '작업중', '작업중', '작업후'],
  };
}

/* 이전 버전 localStorage 데이터에 누락 필드 보완 */
function normalizePage(p: any, templateType?: number): PhotoPage {
  const base: PhotoPage = {
    id: p.id ?? crypto.randomUUID(),
    photos: p.photos ?? (templateType === 2 ? [null, null] : [null, null, null, null]),
    rowTitles: p.rowTitles ?? ['사진설명', '사진설명'],
    rowDescriptions: p.rowDescriptions ?? ['작업 내용', '작업 내용'],
    captions: p.captions ?? ['사진 1', '사진 2', '사진 3', '사진 4'],
  };
  if (templateType === 2) {
    base.workTypes = p.workTypes ?? ['', ''];
    base.subWorkTypes = p.subWorkTypes ?? ['', ''];
    base.photoDates = p.photoDates ?? ['', ''];
    base.locations = p.locations ?? ['', ''];
    base.descriptions = p.descriptions ?? ['', ''];
  }
  if (templateType === 3) {
    base.pageTitle = p.pageTitle ?? '케이블 포설 작업';
    base.workNumber = p.workNumber ?? '1';
    base.workName = p.workName ?? '';
    base.content = p.content ?? '';
    base.photoLabels = p.photoLabels ?? ['작업전', '작업중', '작업중', '작업후'];
  }
  return base;
}

function normalizeDoc(d: any): DocState {
  const def = defaultState();
  return {
    docTitle: d.docTitle ?? def.docTitle,
    projectName: d.projectName ?? def.projectName,
    date: d.date ?? def.date,
    companyName: d.companyName ?? def.companyName,
    logo: d.logo ?? null,
    logoPos: d.logoPos ?? def.logoPos,
    logoSize: d.logoSize ?? def.logoSize,
    titleBoxPos: d.titleBoxPos ?? def.titleBoxPos,
    datePos: d.datePos ?? def.datePos,
    templateType: d.templateType ?? 1,
    pages: Array.isArray(d.pages) ? d.pages.map((p: any) => normalizePage(p, d.templateType)) : [d.templateType === 3 ? newPageT3() : d.templateType === 2 ? newPageT2() : newPage()],
  };
}

function defaultState(templateType: number = 1): DocState {
  const now = new Date();
  return {
    docTitle: templateType === 3 ? '작 업 사 진 첩' : '사 진 대 지',
    projectName: templateType === 3 ? '◯◯◯ 작업' : '◯◯◯ 공사',
    date: templateType === 2 ? `${now.getFullYear()}.  ${String(now.getMonth() + 1).padStart(2, '0')}.` : `${now.getFullYear()}년 ${now.getMonth() + 1}월`,
    companyName: '대성아이넷㈜',
    logo: null,
    logoPos: { x: 250, y: 650 },
    logoSize: { w: 200, h: 80 },
    titleBoxPos: { x: 48, y: 280 },
    datePos: { x: 260, y: 560 },
    templateType,
    pages: [templateType === 3 ? newPageT3() : templateType === 2 ? newPageT2() : newPage()],
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
    <div ref={containerRef} className="no-print-edit" style={{ position: 'absolute', left: pos.x, top: pos.y, width: size.w, height: size.h, cursor: 'move', border: '1px dashed #93c5fd', borderRadius: 4, overflow: 'hidden' }}
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

/* ══════════════════════ Cover Page Template 2 ══════════════════════ */
function CoverPage2({ doc, onChange }: { doc: DocState; onChange: (d: Partial<DocState>) => void }) {
  return (
    <div className="photo-page" style={{ width: 720, height: 960, position: 'relative', background: '#fff', margin: '0 auto 32px', boxShadow: '0 2px 16px rgba(0,0,0,.12)', fontFamily: '"Noto Sans KR", sans-serif', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* 상단 파란 라인 */}
      <div style={{ width: '100%', height: 6, background: '#2563eb', flexShrink: 0 }} />

      {/* 상단 여백 */}
      <div style={{ flex: 1, minHeight: 160 }} />

      {/* 제목 */}
      <div style={{ textAlign: 'center', padding: '0 60px' }}>
        <EditableText
          value={doc.docTitle ?? '사 진 대 지'}
          onChange={v => onChange({ docTitle: v })}
          style={{ fontSize: 38, fontWeight: 700, letterSpacing: 16, color: '#1a1a1a', display: 'block' }}
          tag="h1"
        />
      </div>

      {/* 공사명 */}
      <div style={{ textAlign: 'center', padding: '24px 40px 0', lineHeight: 1.5 }}>
        <EditableText
          value={doc.projectName}
          onChange={v => onChange({ projectName: v })}
          style={{ fontSize: 22, fontWeight: 700, color: '#1a1a1a', display: 'block' }}
        />
      </div>

      {/* 중간 여백 */}
      <div style={{ flex: 1.5, minHeight: 120 }} />

      {/* 날짜 */}
      <div style={{ textAlign: 'center', padding: '0 60px' }}>
        <EditableText
          value={doc.date}
          onChange={v => onChange({ date: v })}
          style={{ fontSize: 20, color: '#333', letterSpacing: 4, display: 'block' }}
        />
      </div>

      {/* 하단 여백 */}
      <div style={{ flex: 1.2, minHeight: 80 }} />

      {/* 회사명 */}
      <div style={{ textAlign: 'center', paddingBottom: 80 }}>
        <EditableText
          value={doc.companyName ?? '대성아이넷㈜'}
          onChange={v => onChange({ companyName: v })}
          style={{ fontSize: 20, color: '#2563eb', textDecoration: 'underline', textUnderlineOffset: 6, display: 'inline-block' }}
        />
      </div>
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

  const handlePhotoSelect = async (idx: number, file: File) => {
    const src = await compressImage(file);
    const newPhotos = [...page.photos] as (PhotoItem | null)[];
    newPhotos[idx] = { src };
    onPageChange({ photos: newPhotos });
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
        <div style={{ borderRight: '1px solid #333', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 5, height: 80, overflow: 'hidden' }}>
          {doc.logo ? <img src={doc.logo} alt="로고" style={{ maxHeight: 60, maxWidth: 108, objectFit: 'contain' }} /> : <span style={{ fontSize: 10, color: '#aaa' }}>로고</span>}
        </div>
        <div style={{ borderRight: '1px solid #333', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 10 }}>
          <span style={{ fontWeight: 700, fontSize: 18 }}>{doc.projectName}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 10 }}>
          <span style={{ fontSize: 16, color: '#555' }}>{doc.date}</span>
        </div>
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
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: 12, cursor: 'pointer', position: 'absolute', inset: 0 }}
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
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: 12, cursor: 'pointer', position: 'absolute', inset: 0 }}
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

/* ══════════════════════ Photo Page Template 2 (건설공사 사진대지) ══════════════════════ */
function PhotoPageView2({ page, doc, pageIndex, onPageChange, onDocChange }: {
  page: PhotoPage; doc: DocState; pageIndex: number;
  onPageChange: (p: Partial<PhotoPage>) => void;
  onDocChange: (d: Partial<DocState>) => void;
}) {
  const fileRefs = useRef<(HTMLInputElement | null)[]>([null, null]);
  const batchRef = useRef<HTMLInputElement>(null);

  const handlePhotoSelect = async (idx: number, file: File) => {
    const src = await compressImage(file);
    const newPhotos = [...page.photos] as (PhotoItem | null)[];
    newPhotos[idx] = { src };
    onPageChange({ photos: newPhotos });
  };

  const removePhoto = (idx: number) => {
    const newPhotos = [...page.photos] as (PhotoItem | null)[];
    newPhotos[idx] = null;
    onPageChange({ photos: newPhotos });
  };

  const NAVY = '#1a2744';
  const BD = `2px solid ${NAVY}`;

  return (
    <div className="photo-page" style={{ width: 720, height: 960, position: 'relative', background: '#fff', margin: '0 auto 32px', boxShadow: '0 2px 16px rgba(0,0,0,.12)', fontFamily: '"Noto Sans KR", sans-serif', display: 'flex', flexDirection: 'column', padding: '24px 24px 20px' }}>
      {/* 상단 파란색 라인 */}
      <div style={{ height: 5, background: '#2563eb' }} />
      {/* MODEL : 공사명 */}
      <div style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: '#dc2626', fontWeight: 800, fontSize: 18, letterSpacing: 1, flexShrink: 0 }}>MODEL :</span>
        <EditableText value={doc.projectName} onChange={v => onDocChange({ projectName: v })} style={{ color: '#1a1a1a', fontSize: 18, fontWeight: 600, flex: 1 }} />
      </div>

      {/* 본문: 2개 사진 블록 */}
      <div style={{ flex: 1, border: BD, display: 'flex', flexDirection: 'column' }}>
        {/* 사진 블록 1 */}
        <div style={{ flex: 1, display: 'flex', borderBottom: BD }}>
          {/* 세로 라벨 */}
          <div style={{ width: 40, borderRight: BD, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', flexShrink: 0 }}>
            <div style={{ writingMode: 'vertical-rl', textOrientation: 'mixed', letterSpacing: 2 }}>
              <EditableText value={page.descriptions?.[0] || '몰딩 1차 라인정리 전'} onChange={v => {
                const arr = [...(page.descriptions ?? ['', ''])] as [string, string];
                arr[0] = v;
                onPageChange({ descriptions: arr });
              }} style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a', whiteSpace: 'nowrap' }} />
            </div>
          </div>
          {/* 사진 영역 */}
          <div style={{ flex: 1, position: 'relative', background: '#fff', overflow: 'hidden' }}>
            {page.photos[0] ? (
              <>
                <img src={page.photos[0].src} alt="" style={{ position: 'absolute', inset: 5, width: 'calc(100% - 10px)', height: 'calc(100% - 10px)', objectFit: 'cover' }} />
                <button className="no-print-edit" style={{ position: 'absolute', top: 4, right: 4, background: '#ef4444', color: '#fff', border: 'none', borderRadius: '50%', width: 22, height: 22, fontSize: 12, cursor: 'pointer', lineHeight: '22px', textAlign: 'center' }}
                  onClick={() => removePhoto(0)}>✕</button>
              </>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: 14, cursor: 'pointer', position: 'absolute', inset: 0 }}
                onClick={() => fileRefs.current[0]?.click()}>
                <Image style={{ width: 32, height: 32, marginBottom: 8, opacity: 0.3 }} />
                사진 클릭하여 등록
              </div>
            )}
            <input ref={el => { fileRefs.current[0] = el; }} type="file" accept="image/*" style={{ display: 'none' }}
              onChange={e => { if (e.target.files?.[0]) { handlePhotoSelect(0, e.target.files[0]); e.target.value = ''; } }} />
          </div>
        </div>

        {/* 사진 블록 2 */}
        <div style={{ flex: 1, display: 'flex' }}>
          {/* 세로 라벨 */}
          <div style={{ width: 40, borderRight: BD, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', flexShrink: 0 }}>
            <div style={{ writingMode: 'vertical-rl', textOrientation: 'mixed', letterSpacing: 2 }}>
              <EditableText value={page.descriptions?.[1] || '케이블 포설/장입 후'} onChange={v => {
                const arr = [...(page.descriptions ?? ['', ''])] as [string, string];
                arr[1] = v;
                onPageChange({ descriptions: arr });
              }} style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a', whiteSpace: 'nowrap' }} />
            </div>
          </div>
          {/* 사진 영역 */}
          <div style={{ flex: 1, position: 'relative', background: '#fff', overflow: 'hidden' }}>
            {page.photos[1] ? (
              <>
                <img src={page.photos[1].src} alt="" style={{ position: 'absolute', inset: 5, width: 'calc(100% - 10px)', height: 'calc(100% - 10px)', objectFit: 'cover' }} />
                <button className="no-print-edit" style={{ position: 'absolute', top: 4, right: 4, background: '#ef4444', color: '#fff', border: 'none', borderRadius: '50%', width: 22, height: 22, fontSize: 12, cursor: 'pointer', lineHeight: '22px', textAlign: 'center' }}
                  onClick={() => removePhoto(1)}>✕</button>
              </>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: 14, cursor: 'pointer', position: 'absolute', inset: 0 }}
                onClick={() => fileRefs.current[1]?.click()}>
                <Image style={{ width: 32, height: 32, marginBottom: 8, opacity: 0.3 }} />
                사진 클릭하여 등록
              </div>
            )}
            <input ref={el => { fileRefs.current[1] = el; }} type="file" accept="image/*" style={{ display: 'none' }}
              onChange={e => { if (e.target.files?.[0]) { handlePhotoSelect(1, e.target.files[0]); e.target.value = ''; } }} />
          </div>
        </div>
      </div>

      {/* 하단 파란색 이중 라인 */}
      <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div style={{ height: 4, background: '#2563eb' }} />
        <div style={{ height: 1.5, background: '#2563eb' }} />
      </div>

      {/* 페이지 번호 */}
      <div style={{ paddingTop: 8, textAlign: 'center', fontSize: 12, color: '#555' }}>
        {pageIndex + 1}
      </div>
    </div>
  );
}

/* ══════════════════════ Photo Page Template 3 (작업사진첩) ══════════════════════ */
function PhotoPageView3({ page, doc, pageIndex, onPageChange, onDocChange }: {
  page: PhotoPage; doc: DocState; pageIndex: number;
  onPageChange: (p: Partial<PhotoPage>) => void;
  onDocChange: (d: Partial<DocState>) => void;
}) {
  const fileRefs = useRef<(HTMLInputElement | null)[]>([null, null, null, null]);
  const batchRef = useRef<HTMLInputElement>(null);

  const handlePhotoSelect = async (idx: number, file: File) => {
    const src = await compressImage(file);
    const newPhotos = [...page.photos] as (PhotoItem | null)[];
    newPhotos[idx] = { src };
    onPageChange({ photos: newPhotos });
  };

  const removePhoto = (idx: number) => {
    const newPhotos = [...page.photos] as (PhotoItem | null)[];
    newPhotos[idx] = null;
    onPageChange({ photos: newPhotos });
  };

  const labels = page.photoLabels ?? ['작업전', '작업중', '작업중', '작업후'];

  const renderPhotoCell = (idx: number) => {
    const photo = page.photos[idx];
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: idx % 2 === 0 ? '1px solid #333' : undefined }}>
        {/* 사진 라벨 */}
        <div style={{ borderBottom: '1px solid #333', padding: '4px 6px', textAlign: 'center', background: '#fff' }}>
          <EditableText value={labels[idx]} onChange={v => {
            const newLabels = [...labels] as [string, string, string, string];
            newLabels[idx] = v;
            onPageChange({ photoLabels: newLabels });
          }} style={{ fontSize: 13, fontWeight: 600, color: '#333' }} />
        </div>
        {/* 사진 영역 */}
        <div style={{ flex: 1, position: 'relative', background: '#fafafa', overflow: 'hidden', minHeight: 200 }}>
          {photo ? (
            <>
              <img src={photo.src} alt="" style={{ position: 'absolute', inset: 5, width: 'calc(100% - 10px)', height: 'calc(100% - 10px)', objectFit: 'cover' }} />
              <button className="no-print-edit" style={{ position: 'absolute', top: 4, right: 4, background: '#ef4444', color: '#fff', border: 'none', borderRadius: '50%', width: 20, height: 20, fontSize: 11, cursor: 'pointer', lineHeight: '20px', textAlign: 'center' }}
                onClick={() => removePhoto(idx)}>✕</button>
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: 12, cursor: 'pointer', position: 'absolute', inset: 0 }}
              onClick={() => fileRefs.current[idx]?.click()}>
              <Image style={{ width: 28, height: 28, marginBottom: 6, opacity: 0.3 }} />
              사진 클릭
            </div>
          )}
          <input ref={el => { fileRefs.current[idx] = el; }} type="file" accept="image/*" style={{ display: 'none' }}
            onChange={e => { if (e.target.files?.[0]) { handlePhotoSelect(idx, e.target.files[0]); e.target.value = ''; } }} />
        </div>
      </div>
    );
  };

  return (
    <div className="photo-page" style={{ width: 720, height: 960, position: 'relative', background: '#fff', margin: '0 auto 32px', boxShadow: '0 2px 16px rgba(0,0,0,.12)', fontFamily: '"Noto Sans KR", sans-serif', display: 'flex', flexDirection: 'column', padding: '32px 32px 24px' }}>
      {/* 제목 */}
      <div style={{ border: '2px solid #333', borderBottom: '1px solid #333', padding: '14px 16px', textAlign: 'center' }}>
        <EditableText value={page.pageTitle ?? '케이블 포설 작업'} onChange={v => onPageChange({ pageTitle: v })} style={{ fontSize: 22, fontWeight: 700, letterSpacing: 6, color: '#1a1a1a' }} tag="h2" />
      </div>

      {/* 번호 / 작업명 */}
      <div style={{ display: 'flex', border: '1px solid #333', borderBottom: '1px solid #333' }}>
        <div style={{ width: 70, borderRight: '1px solid #333', padding: '8px 6px', textAlign: 'center', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: 6 }}>번 호</span>
        </div>
        <div style={{ width: 50, borderRight: '1px solid #333', padding: '8px 6px', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <EditableText value={page.workNumber ?? '1'} onChange={v => onPageChange({ workNumber: v })} style={{ fontSize: 14, fontWeight: 500 }} />
        </div>
        <div style={{ width: 70, borderRight: '1px solid #333', padding: '8px 6px', textAlign: 'center', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: 4 }}>작업명</span>
        </div>
        <div style={{ flex: 1, padding: '8px 10px', display: 'flex', alignItems: 'center' }}>
          <EditableText value={page.workName ?? ''} onChange={v => onPageChange({ workName: v })} style={{ fontSize: 14, fontWeight: 500, width: '100%' }} />
        </div>
      </div>

      {/* 내용 */}
      <div style={{ display: 'flex', border: '1px solid #333', borderTop: 'none' }}>
        <div style={{ width: 70, borderRight: '1px solid #333', padding: '8px 6px', textAlign: 'center', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: 6 }}>내 용</span>
        </div>
        <div style={{ flex: 1, padding: '8px 10px', display: 'flex', alignItems: 'center' }}>
          <EditableText value={page.content ?? ''} onChange={v => onPageChange({ content: v })} style={{ fontSize: 13, width: '100%' }} />
        </div>
      </div>

      {/* 상단 사진 행 (2장) */}
      <div style={{ flex: 1, display: 'flex', border: '1px solid #333' }}>
        {renderPhotoCell(0)}
        {renderPhotoCell(1)}
      </div>

      {/* 하단 사진 행 (2장) */}
      <div style={{ flex: 1, display: 'flex', borderLeft: '1px solid #333', borderRight: '1px solid #333', borderBottom: '1px solid #333' }}>
        {renderPhotoCell(2)}
        {renderPhotoCell(3)}
      </div>

      {/* 페이지 번호 */}
      <div style={{ paddingTop: 12, textAlign: 'center', fontSize: 13, color: '#333' }}>
        {pageIndex + 1}
      </div>
    </div>
  );
}

/* ══════════════════════ Main Component ══════════════════════ */
export function PhotoDocPage() {
  const [docList, setDocList] = useState<DocListItem[]>([]);
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [doc, setDoc] = useState<DocState>(defaultState);
  const [loaded, setLoaded] = useState(false);

  // Refs for latest values (closure-safe)
  const docRef = useRef(doc);
  const activeDocIdRef = useRef(activeDocId);
  const docListRef = useRef(docList);
  useEffect(() => { docRef.current = doc; }, [doc]);
  useEffect(() => { activeDocIdRef.current = activeDocId; }, [activeDocId]);
  useEffect(() => { docListRef.current = docList; }, [docList]);

  // Load doc list + ensure all 3 templates always exist
  useEffect(() => {
    let list = getStoredValue<DocListItem[]>(DOC_LIST_KEY, []);

    // 기존 단일 문서 마이그레이션
    if (list.length === 0) {
      const legacy = getStoredValue<DocState | null>(LEGACY_STORAGE_KEY, null);
      const firstId = crypto.randomUUID();
      const firstDoc = legacy ? normalizeDoc(legacy) : defaultState(1);
      list = [{ id: firstId, name: '사진대지양식1', templateType: 1 }];
      setStoredValue(STORAGE_KEY_PREFIX + firstId, firstDoc);
    }

    // 3개 양식이 항상 존재하도록 보장
    const templates = [
      { type: 1, name: '사진대지양식1' },
      { type: 2, name: '사진대지양식2' },
      { type: 3, name: '사진대지양식3' },
    ];
    for (const tmpl of templates) {
      const exists = list.find(d => (d.templateType ?? 1) === tmpl.type);
      if (!exists) {
        const newId = crypto.randomUUID();
        list.push({ id: newId, name: tmpl.name, templateType: tmpl.type });
        setStoredValue(STORAGE_KEY_PREFIX + newId, defaultState(tmpl.type));
      }
    }
    // templateType 누락된 기존 데이터 보정
    list = list.map(d => d.templateType ? d : { ...d, templateType: 1 });
    setStoredValue(DOC_LIST_KEY, list);

    setDocList(list);

    // 마지막 Active 탭 복원 또는 첫번째 문서 활성화
    const lastActiveType = getStoredValue<number>('photodoc_active_template', 1);
    const target = list.find(d => (d.templateType ?? 1) === lastActiveType) ?? list[0];
    setActiveDocId(target.id);
    const saved = getStoredValue<DocState | null>(STORAGE_KEY_PREFIX + target.id, null);
    if (saved) setDoc(normalizeDoc(saved));
    setLoaded(true);
  }, []);

  // 문서 전환 (ref 기반, stale closure 없음)
  const switchDoc = useCallback((docId: string) => {
    const curId = activeDocIdRef.current;
    if (docId === curId) return;
    // 현재 문서 즉시 저장
    if (curId) {
      const curDoc = docRef.current;
      setStoredValue(STORAGE_KEY_PREFIX + curId, curDoc);
    }
    // ref를 먼저 업데이트 (Auto-save가 잘못된 대상에 저장 방지)
    activeDocIdRef.current = docId;
    // 새 문서 로드
    const saved = getStoredValue<DocState | null>(STORAGE_KEY_PREFIX + docId, null);
    const targetItem = docListRef.current.find(d => d.id === docId);
    const targetType = targetItem?.templateType ?? 1;
    const newDoc = saved ? normalizeDoc(saved) : defaultState(targetType);
    docRef.current = newDoc;
    setDoc(newDoc);
    setActiveDocId(docId);
    setStoredValue('photodoc_active_template', targetType);
  }, []);

  // 양식 탭 전환 (ref 기반)
  const switchToTemplate = useCallback((templateType: number) => {
    const list = docListRef.current;
    const existing = list.find(d => (d.templateType ?? 1) === templateType);
    if (existing) {
      switchDoc(existing.id);
    } else {
      // 현재 문서 즉시 저장
      const curId = activeDocIdRef.current;
      if (curId) {
        setStoredValue(STORAGE_KEY_PREFIX + curId, docRef.current);
      }
      // 새 양식 자동 생성
      const newId = crypto.randomUUID();
      const newName = `사진대지 양식${templateType}`;
      const newList = [...list, { id: newId, name: newName, templateType }];
      setDocList(newList);
      setStoredValue(DOC_LIST_KEY, newList);

      const newDoc = defaultState(templateType);
      setStoredValue(STORAGE_KEY_PREFIX + newId, newDoc);

      // ref 먼저 업데이트
      activeDocIdRef.current = newId;
      docRef.current = newDoc;
      setDoc(newDoc);
      setActiveDocId(newId);
      setStoredValue('photodoc_active_template', templateType);
    }
  }, [switchDoc]);

  // Auto-save: doc과 activeDocId가 일치할 때만 저장
  useEffect(() => {
    if (!loaded || !activeDocId) return;
    // doc의 templateType과 activeDocId의 templateType이 일치하는지 확인
    const activeItem = docListRef.current.find(d => d.id === activeDocId);
    const activeType = activeItem?.templateType ?? 1;
    const docType = doc.templateType ?? 1;
    if (activeType !== docType) return; // 전환 중 — 저장하지 않음
    const timer = setTimeout(() => {
      // 저장 시점에도 다시 확인
      if (activeDocIdRef.current === activeDocId) {
        setStoredValue(STORAGE_KEY_PREFIX + activeDocId, doc);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [doc, loaded, activeDocId]);

  const updateDoc = useCallback((partial: Partial<DocState>) => {
    setDoc(prev => ({ ...prev, ...partial }));
  }, []);

  const updatePage = useCallback((pageId: string, partial: Partial<PhotoPage>) => {
    setDoc(prev => ({
      ...prev,
      pages: prev.pages.map(p => p.id === pageId ? { ...p, ...partial } : p),
    }));
  }, []);

  const addPage = () => setDoc(prev => {
    const tt = prev.templateType ?? 1;
    const np = tt === 3 ? newPageT3(prev.pages.length + 1) : tt === 2 ? newPageT2() : newPage();
    return { ...prev, pages: [...prev.pages, np] };
  });
  const removePage = (id: string) => {
    if (!confirm('이 페이지를 삭제하시겠습니까?')) return;
    setDoc(prev => ({ ...prev, pages: prev.pages.filter(p => p.id !== id) }));
  };

  const handlePrint = () => window.print();

  // 전체 문서 일괄등록: 모든 페이지에 순서대로 사진 배분, 부족하면 새 페이지 생성
  const globalBatchRef = useRef<HTMLInputElement>(null);
  const handleGlobalBatchUpload = useCallback((files: FileList) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    // 모든 파일을 읽어서 순서대로 배분
    let loadedCount = 0;
    const results: { idx: number; src: string }[] = [];

    fileArray.forEach((file, fileIdx) => {
      compressImage(file).then(src => {
        results.push({ idx: fileIdx, src });
        loadedCount++;
        if (loadedCount === fileArray.length) {
          // 모든 파일 로드 완료 - 순서대로 정렬
          results.sort((a, b) => a.idx - b.idx);
          const srcs = results.map(r => r.src);

          setDoc(prev => {
            const tt = prev.templateType ?? 1;
            const slotsPerPage = tt === 2 ? 2 : 4;
            const pages = [...prev.pages];
            let srcIdx = 0;

            // 기존 페이지 빈 슬롯부터 채우기
            for (let pi = 0; pi < pages.length && srcIdx < srcs.length; pi++) {
              const photos = [...pages[pi].photos] as (PhotoItem | null)[];
              for (let si = 0; si < slotsPerPage && srcIdx < srcs.length; si++) {
                if (photos[si] === null) {
                  photos[si] = { src: srcs[srcIdx++] };
                }
              }
              pages[pi] = { ...pages[pi], photos };
            }

            // 남은 사진은 새 페이지 생성하여 채우기
            while (srcIdx < srcs.length) {
              const np = tt === 3 ? newPageT3(pages.length + 1) : tt === 2 ? newPageT2() : newPage();
              const photos = [...np.photos] as (PhotoItem | null)[];
              for (let si = 0; si < slotsPerPage && srcIdx < srcs.length; si++) {
                photos[si] = { src: srcs[srcIdx++] };
              }
              pages.push({ ...np, photos });
            }

            return { ...prev, pages };
          });
        }
      });
    });
  }, []);

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
        {/* 양식 탭 */}
        <div style={{ display: 'flex', gap: 0, border: '1px solid #cbd5e1', borderRadius: 8, overflow: 'hidden' }}>
          {[
            { type: 1, label: '사진대지양식1', sub: '2×2 격자' },
            { type: 2, label: '사진대지양식2', sub: '사진 2장' },
            { type: 3, label: '사진대지양식3', sub: '작업사진첩' },
          ].map((tab, i) => {
            const currentType = docList.find(d => d.id === activeDocId)?.templateType ?? 1;
            const isActive = currentType === tab.type;
            return (
              <button
                key={tab.type}
                onClick={() => switchToTemplate(tab.type)}
                style={{
                  padding: '6px 14px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: isActive ? 700 : 500,
                  background: isActive ? '#2563eb' : '#fff', color: isActive ? '#fff' : '#334155',
                  borderRight: i < 2 ? '1px solid #cbd5e1' : 'none',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1,
                  transition: 'all 0.15s',
                }}
              >
                <span>{tab.label}</span>
                <span style={{ fontSize: 10, opacity: 0.75 }}>{tab.sub}</span>
              </button>
            );
          })}
        </div>

        <span style={{ fontSize: 12, color: '#64748b' }}>{(doc.templateType ?? 1) === 3 ? `사진 ${doc.pages.length}장` : `표지 1장 + 사진 ${doc.pages.length}장`}</span>
        <div style={{ flex: 1 }} />
        <Button variant="outline" size="sm" className="gap-1" onClick={() => globalBatchRef.current?.click()}>
          <Upload className="h-3.5 w-3.5" /> 사진 일괄등록
        </Button>
        <input ref={globalBatchRef} type="file" accept="image/*" multiple style={{ display: 'none' }}
          onChange={e => { if (e.target.files) handleGlobalBatchUpload(e.target.files); e.target.value = ''; }} />
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
        {(doc.templateType ?? 1) === 3 ? null : (doc.templateType ?? 1) === 2 ? (
          <CoverPage2 doc={doc} onChange={updateDoc} />
        ) : (
          <CoverPage doc={doc} onChange={updateDoc} />
        )}

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
            {(doc.templateType ?? 1) === 3 ? (
              <PhotoPageView3 page={page} doc={doc} pageIndex={i}
                onPageChange={p => updatePage(page.id, p)}
                onDocChange={updateDoc} />
            ) : (doc.templateType ?? 1) === 2 ? (
              <PhotoPageView2 page={page} doc={doc} pageIndex={i}
                onPageChange={p => updatePage(page.id, p)}
                onDocChange={updateDoc} />
            ) : (
              <PhotoPageView page={page} doc={doc} pageIndex={i}
                onPageChange={p => updatePage(page.id, p)}
                onDocChange={updateDoc} />
            )}
          </div>
        ))}
      </div>
    </>
  );
}
