'use client';

import { useState, useRef, useEffect, useCallback } from "react";
import { useItems } from "@/hooks/useItems";
import { useClients } from "@/hooks/useClients";
import type { Item as DbItem, Client as DbClient } from "@/types";

interface Item {
  id: number;
  name: string;
  qty: number;
  price: number;
  note: string;
  photoUrl: string | null;
}

interface Company {
  id: number;
  name: string;
  ceo: string;
  bizNo: string;
  address: string;
  tel: string;
  email: string;
  stampImg: string | null;
}

interface Client {
  name: string;
  address: string;
  contact: string;
  tel: string;
}

const initialItems: Item[] = [
  { id: 1, name: "(서통)타워1차_ABCD 도어폰 교체", qty: 1, price: 630000, note: "AS 포함", photoUrl: null },
  { id: 2, name: "AL3M 미화모터락", qty: 2, price: 850000, note: "", photoUrl: null },
  { id: 3, name: "도어크루저 미화(노출형)", qty: 1, price: 480000, note: "", photoUrl: null },
];

const newCompany = (id: number): Company => ({
  id, name: "", ceo: "", bizNo: "", address: "", tel: "", email: "", stampImg: null,
});

const STORAGE_KEY = "estimate_form_data";

function loadFromStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

function saveToStorage(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

// ===== IndexedDB 도장 이미지 저장소 =====
const STAMP_DB_NAME = "estimate_stamps_db";
const STAMP_STORE = "stamps";

function openStampDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(STAMP_DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STAMP_STORE)) {
        req.result.createObjectStore(STAMP_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveStampToDB(companyId: number, dataUrl: string | null): Promise<void> {
  try {
    const db = await openStampDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STAMP_STORE, "readwrite");
      if (dataUrl) {
        tx.objectStore(STAMP_STORE).put(dataUrl, `stamp_${companyId}`);
      } else {
        tx.objectStore(STAMP_STORE).delete(`stamp_${companyId}`);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) { console.warn("IndexedDB stamp save failed:", e); }
}

async function loadStampFromDB(companyId: number): Promise<string | null> {
  try {
    const db = await openStampDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STAMP_STORE, "readonly");
      const req = tx.objectStore(STAMP_STORE).get(`stamp_${companyId}`);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn("IndexedDB stamp load failed:", e);
    return null;
  }
}

async function loadAllStampsFromDB(companyIds: number[]): Promise<Record<number, string | null>> {
  const result: Record<number, string | null> = {};
  try {
    const db = await openStampDB();
    const tx = db.transaction(STAMP_STORE, "readonly");
    const store = tx.objectStore(STAMP_STORE);
    await Promise.all(companyIds.map(id => new Promise<void>((resolve) => {
      const req = store.get(`stamp_${id}`);
      req.onsuccess = () => { result[id] = req.result || null; resolve(); };
      req.onerror = () => { result[id] = null; resolve(); };
    })));
  } catch (e) {
    console.warn("IndexedDB batch load failed:", e);
  }
  return result;
}

function removeWhiteBg(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = document.createElement("img");
    img.crossOrigin = "anonymous";
    img.onload = () => {
      // 도장 이미지를 최대 300x300으로 리사이즈 (localStorage 용량 절약)
      const MAX_SIZE = 300;
      let w = img.naturalWidth || img.width;
      let h = img.naturalHeight || img.height;
      if (w > MAX_SIZE || h > MAX_SIZE) {
        const scale = Math.min(MAX_SIZE / w, MAX_SIZE / h);
        w = Math.round(w * scale);
        h = Math.round(h * scale);
      }
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(dataUrl); return; }
      ctx.drawImage(img, 0, 0, w, h);

      let imageData: ImageData;
      try {
        imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      } catch {
        resolve(dataUrl); return;
      }

      const d = imageData.data;
      const total = d.length / 4;

      // 1단계: 전체 이미지의 배경색 자동 감지 (가장 많은 색상 = 배경)
      // 모서리 영역 샘플링으로 배경색 추정
      const cornerPixels: [number, number, number][] = [];
      const cw = canvas.width, ch = canvas.height;
      const sampleSize = Math.max(5, Math.round(Math.min(cw, ch) * 0.1));
      for (let y = 0; y < sampleSize; y++) {
        for (let x = 0; x < sampleSize; x++) {
          // 4개 모서리
          for (const [sx, sy] of [[x, y], [cw - 1 - x, y], [x, ch - 1 - y], [cw - 1 - x, ch - 1 - y]]) {
            const idx = (sy * cw + sx) * 4;
            if (idx >= 0 && idx < d.length) {
              cornerPixels.push([d[idx], d[idx + 1], d[idx + 2]]);
            }
          }
        }
      }
      // 배경색 평균 계산
      let bgR = 255, bgG = 255, bgB = 255;
      if (cornerPixels.length > 0) {
        bgR = Math.round(cornerPixels.reduce((s, p) => s + p[0], 0) / cornerPixels.length);
        bgG = Math.round(cornerPixels.reduce((s, p) => s + p[1], 0) / cornerPixels.length);
        bgB = Math.round(cornerPixels.reduce((s, p) => s + p[2], 0) / cornerPixels.length);
      }

      for (let i = 0; i < d.length; i += 4) {
        const r = d[i], g = d[i + 1], b = d[i + 2], a = d[i + 3];
        if (a === 0) continue;

        // 감지된 배경색과의 거리
        const distBg = Math.sqrt((bgR - r) ** 2 + (bgG - g) ** 2 + (bgB - b) ** 2);
        // 흰색과의 거리
        const distWhite = Math.sqrt((255 - r) ** 2 + (255 - g) ** 2 + (255 - b) ** 2);
        // 더 가까운 쪽 사용
        const dist = Math.min(distBg, distWhite);

        // 밝기
        const brightness = (r * 0.299 + g * 0.587 + b * 0.114);
        // 채도
        const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
        const saturation = mx === 0 ? 0 : (mx - mn) / mx;

        if (dist < 100 && saturation < 0.2) {
          // 배경색에 가깝고 채도 낮음 → 완전 투명
          d[i + 3] = 0;
        } else if (dist < 160 && saturation < 0.15 && brightness > 150) {
          // 경계 영역 → 부드러운 페이드
          const alpha = Math.round(((dist - 100) / 60) * 255);
          d[i + 3] = Math.min(a, alpha);
        } else if (brightness > 200 && saturation < 0.1) {
          // 밝고 무채색 → 투명
          d[i + 3] = 0;
        }
        // 그 외 (잉크, 빨간 인감 등) → 원본 유지
      }
      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

function downloadPng(dataUrl: string, filename: string) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function ImageUploadBox({ label, value, onChange }: { label: string; value: string | null; onChange: (v: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result as string;
      const transparent = await removeWhiteBg(dataUrl);
      onChange(transparent);
    };
    reader.readAsDataURL(file);
  };
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: "10px", color: "#999", marginBottom: "5px" }}>{label}</div>
      <div
        onClick={() => ref.current?.click()}
        style={{
          width: "80px", height: "80px",
          border: value ? "none" : "2px dashed #c8d0e0",
          borderRadius: "8px",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", background: value ? "transparent" : "#f8f9fc",
          overflow: "hidden", position: "relative", transition: "border-color 0.2s",
        }}
        onMouseEnter={e => { if (!value) (e.currentTarget as HTMLDivElement).style.borderColor = "#1a237e"; }}
        onMouseLeave={e => { if (!value) (e.currentTarget as HTMLDivElement).style.borderColor = "#c8d0e0"; }}
      >
        {value ? (
          <>
            <img src={value} alt={label} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
            <div
              className="no-print"
              style={{
                position: "absolute", bottom: 0, left: 0, right: 0,
                background: "rgba(0,0,0,0.55)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "10px", color: "white",
                gap: "4px", padding: "3px 2px",
                borderRadius: "0 0 8px 8px",
              }}
            >
              <span style={{ opacity: 0.9 }}>변경</span>
              <span style={{ color: "rgba(255,255,255,0.4)", margin: "0 1px" }}>|</span>
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  if (value) downloadPng(value, `${label}_투명배경.png`);
                }}
                style={{ cursor: "pointer", opacity: 0.9 }}
                title="투명 배경 PNG 다운로드"
              >💾 저장</span>
            </div>
          </>
        ) : (
          <span style={{ fontSize: "10px", color: "#aab0c0", lineHeight: 1.6, textAlign: "center" }}>
            📎<br />{label}<br />업로드
          </span>
        )}
      </div>
      <input ref={ref} type="file" accept="image/*" onChange={handleFile} style={{ display: "none" }} />
    </div>
  );
}

const defaultCompanies: Company[] = [
  { id: 1, name: "(주)서통시큐리티", ceo: "홍길동", bizNo: "123-45-67890", address: "서울시 강남구 도곡동 467", tel: "02-1234-5678", email: "info@seotong.co.kr", stampImg: null },
];
const defaultClient: Client = { name: "(서통)타워1차_ABCD", address: "서울시 강남구 도곡동 467", contact: "김담당", tel: "010-1234-5678" };

export default function EstimateForm() {
  const [items, setItems] = useState<Item[]>(() => loadFromStorage(`${STORAGE_KEY}_items`, initialItems));
  const [companies, setCompanies] = useState<Company[]>(() => loadFromStorage(`${STORAGE_KEY}_companies`, defaultCompanies));
  const [activeCompanyId, setActiveCompanyId] = useState<number>(() => loadFromStorage(`${STORAGE_KEY}_activeId`, 1));
  const [client, setClient] = useState<Client>(() => loadFromStorage(`${STORAGE_KEY}_client`, defaultClient));
  const [estimateNo, setEstimateNo] = useState(() => loadFromStorage(`${STORAGE_KEY}_estimateNo`, "2026-001"));
  const [date, setDate] = useState(() => loadFromStorage(`${STORAGE_KEY}_date`, "2026-02-22"));
  const [vatIncluded, setVatIncluded] = useState(() => loadFromStorage(`${STORAGE_KEY}_vat`, true));
  const [note, setNote] = useState(() => loadFromStorage(`${STORAGE_KEY}_note`, "• 본 견적서는 발행일로부터 30일간 유효합니다.\n• 설치비 별도 문의 바랍니다."));

  // IndexedDB에서 도장 이미지 복원
  const [stampsLoaded, setStampsLoaded] = useState(false);
  useEffect(() => {
    const ids = companies.map(c => c.id);
    loadAllStampsFromDB(ids).then(stamps => {
      setCompanies(prev => prev.map(c => ({
        ...c,
        stampImg: stamps[c.id] ?? c.stampImg,
      })));
      setStampsLoaded(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // localStorage에 자동 저장 (stampImg는 IndexedDB에 별도 저장)
  useEffect(() => {
    // localStorage에는 stampImg 제외한 데이터 저장 (용량 절약)
    const companiesForStorage = companies.map(c => ({ ...c, stampImg: c.stampImg ? "__STAMP_IN_IDB__" : null }));
    saveToStorage(`${STORAGE_KEY}_companies`, companiesForStorage);
    // IndexedDB에 도장 이미지 개별 저장
    if (stampsLoaded) {
      companies.forEach(c => {
        saveStampToDB(c.id, c.stampImg);
      });
    }
  }, [companies, stampsLoaded]);
  useEffect(() => { saveToStorage(`${STORAGE_KEY}_activeId`, activeCompanyId); }, [activeCompanyId]);
  useEffect(() => { saveToStorage(`${STORAGE_KEY}_client`, client); }, [client]);
  useEffect(() => { saveToStorage(`${STORAGE_KEY}_items`, items); }, [items]);
  useEffect(() => { saveToStorage(`${STORAGE_KEY}_estimateNo`, estimateNo); }, [estimateNo]);
  useEffect(() => { saveToStorage(`${STORAGE_KEY}_date`, date); }, [date]);
  useEffect(() => { saveToStorage(`${STORAGE_KEY}_vat`, vatIncluded); }, [vatIncluded]);
  useEffect(() => { saveToStorage(`${STORAGE_KEY}_note`, note); }, [note]);

  const activeCompany = companies.find(c => c.id === activeCompanyId) || companies[0];
  const updateActiveCompany = (field: keyof Company, value: string | null) =>
    setCompanies(prev => prev.map(c => c.id === activeCompanyId ? { ...c, [field]: value } : c));

  const addCompany = () => {
    if (companies.length >= 5) return;
    const id = Date.now();
    setCompanies(prev => [...prev, newCompany(id)]);
    setActiveCompanyId(id);
  };
  const removeCompany = (id: number) => {
    if (companies.length === 1) return;
    const remaining = companies.filter(c => c.id !== id);
    setCompanies(remaining);
    setActiveCompanyId(remaining[0].id);
  };

  const subtotal = items.reduce((s, i) => s + i.qty * i.price, 0);
  const vat = vatIncluded ? Math.round(subtotal * 0.1) : 0;
  const total = subtotal + vat;

  const addItem = () => setItems([...items, { id: Date.now(), name: "", qty: 1, price: 0, note: "", photoUrl: null }]);
  const removeItem = (id: number) => setItems(items.filter(i => i.id !== id));
  const updateItem = (id: number, field: keyof Item, value: string | number | null) => setItems(items.map(i => i.id === id ? { ...i, [field]: value } : i));

  // 품목 검색 관련
  const { data: dbItems } = useItems();
  const [searchingItemId, setSearchingItemId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const searchRef = useRef<HTMLDivElement>(null);

  const filteredDbItems = (dbItems || []).filter(di =>
    searchQuery.length === 0 || di.name.toLowerCase().includes(searchQuery.toLowerCase())
  ).slice(0, 50);

  const selectDbItem = (itemId: number, dbItem: DbItem) => {
    setItems(prev => prev.map(i => i.id === itemId ? {
      ...i,
      name: dbItem.name,
      price: dbItem.price || i.price,
      photoUrl: dbItem.photo_url || null,
    } : i));
    setSearchingItemId(null);
    setSearchQuery("");
  };

  // 외부 클릭시 검색 닫기
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchingItemId(null);
        setSearchQuery("");
      }
      if (clientSearchRef.current && !clientSearchRef.current.contains(e.target as Node)) {
        setClientSearchOpen(false);
        setClientSearchQuery("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // 거래처 검색 관련
  const { data: dbClients } = useClients();
  const [clientSearchOpen, setClientSearchOpen] = useState(false);
  const [clientSearchQuery, setClientSearchQuery] = useState("");
  const clientSearchRef = useRef<HTMLDivElement>(null);

  const filteredDbClients = (dbClients || []).filter(dc =>
    clientSearchQuery.length === 0 || dc.name.toLowerCase().includes(clientSearchQuery.toLowerCase())
  ).slice(0, 50);

  const selectDbClient = (dbClient: DbClient) => {
    setClient(prev => ({
      ...prev,
      name: dbClient.name,
      address: dbClient.address || "",
    }));
    setClientSearchOpen(false);
    setClientSearchQuery("");
  };
  const won = (n: number) => "₩ " + n.toLocaleString();

  const estimatePaperRef = useRef<HTMLDivElement>(null);

  // 모바일 자동 축소: 680px 견적서를 화면 폭에 맞추기
  const paperWrapperRef = useRef<HTMLDivElement>(null);
  const [paperScale, setPaperScale] = useState(1);
  const [manualZoom, setManualZoom] = useState(1);
  const effectiveScale = paperScale * manualZoom;

  const zoomIn = () => setManualZoom(prev => Math.min(Math.round((prev + 0.1) * 10) / 10, 2.0));
  const zoomOut = () => setManualZoom(prev => Math.max(Math.round((prev - 0.1) * 10) / 10, 0.3));
  const zoomReset = () => setManualZoom(1);

  useEffect(() => {
    const updateScale = () => {
      const wrapper = paperWrapperRef.current;
      if (!wrapper) return;
      const availableWidth = wrapper.clientWidth;
      const paperMinWidth = 680;
      if (availableWidth < paperMinWidth) {
        setPaperScale(availableWidth / paperMinWidth);
      } else {
        setPaperScale(1);
      }
    };
    updateScale();
    window.addEventListener('resize', updateScale);
    // ResizeObserver로 컨테이너 크기 변화 감지
    let ro: ResizeObserver | null = null;
    if (paperWrapperRef.current && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(updateScale);
      ro.observe(paperWrapperRef.current);
    }
    return () => {
      window.removeEventListener('resize', updateScale);
      ro?.disconnect();
    };
  }, []);

  // 인쇄 함수 - 새 창을 열고 견적서만 출력 (Android WebView 호환)
  const handlePrint = useCallback(() => {
    const paperEl = estimatePaperRef.current;
    if (!paperEl) return;

    // no-print 요소 숨기고 HTML 추출
    const cloned = paperEl.cloneNode(true) as HTMLElement;
    cloned.querySelectorAll('.no-print').forEach(el => el.remove());

    const printHTML = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>견적서</title>
<style>
  * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; margin: 0; padding: 0; }
  @page { size: A4 portrait; margin: 6mm; }
  html, body { font-family: 'Malgun Gothic', '맑은 고딕', 'Apple SD Gothic Neo', sans-serif; background: white; margin: 0; padding: 0; width: 100%; height: 100%; }
  body { display: flex; align-items: flex-start; justify-content: center; }
  .estimate-paper { width: 100%; max-width: 100%; background: white; overflow: visible; border-radius: 0 !important; box-shadow: none !important; }
  .no-print { display: none !important; }
  .no-print-col { width: 0 !important; padding: 0 !important; overflow: hidden !important; }
  input, textarea { outline: none; border: none; background: transparent; font-family: inherit; }
  table { border-collapse: collapse; width: 100%; }

  /* === 하단 요소 페이지 바닥 고정 === */
  .est-body { display: flex; flex-direction: column; }
  .est-spacer { flex: 1 1 auto; }
  .est-bottom { flex-shrink: 0; }

  /* === 1페이지 맞춤 축소 === */
  .est-header { padding: 14px 24px !important; }
  .est-header .est-title { font-size: 24px !important; letter-spacing: 6px !important; }
  .est-header .est-subtitle { font-size: 9px !important; margin-bottom: 3px !important; }
  .est-header input { font-size: 12px !important; }
  .est-body { padding: 12px 22px !important; }
  .est-parties { gap: 10px !important; margin-bottom: 8px !important; }
  .est-parties span, .est-parties input { font-size: 10.5px !important; line-height: 1.35 !important; }
  .est-parties div[style*="padding: 12px 14px"] { padding: 6px 10px !important; }
  .est-parties div[style*="marginBottom: 5px"],
  .est-parties div[style*="marginBottom: 4px"] { margin-bottom: 2px !important; }
  .est-total-banner { padding: 8px 14px !important; margin-bottom: 8px !important; }
  .est-total-banner .est-total-amount { font-size: 18px !important; }
  .est-total-banner div[style*="font-size: 14px"] { font-size: 11px !important; }
  .est-total-banner div[style*="font-size: 11px"] { font-size: 9px !important; }
  .est-table { margin-bottom: 6px !important; font-size: 10.5px !important; }
  .est-table th { padding: 5px 6px !important; font-size: 10px !important; height: 25px !important; }
  .est-table td { padding: 4px 6px !important; font-size: 10.5px !important; height: 25px !important; }
  .est-table td input { font-size: 10.5px !important; }
  .est-table td[style*="height: 34px"] { height: 25px !important; }
  .est-summary-row { margin-bottom: 6px !important; }
  .est-summary-row div[style*="padding: 10px 24px"] { padding: 6px 14px !important; min-width: 100px !important; }
  .est-summary-row span { font-size: 10.5px !important; }
  .est-photos { gap: 8px !important; margin-bottom: 8px !important; }
  .est-photos > div { min-height: 250px !important; max-height: 250px !important; }
  .est-photos img { object-fit: contain !important; }
  .est-photos-empty { display: none !important; }
  .est-note { margin-bottom: 6px !important; }
  .est-note textarea { font-size: 10px !important; padding: 5px 10px !important; min-height: 24px !important; height: auto !important; }
  .est-note .est-note-header { padding: 4px 10px !important; font-size: 10.5px !important; }
  .est-note-empty { display: none !important; }
  .est-signature { margin-bottom: 4px !important; gap: 10px !important; margin-top: 6px !important; }
  .est-stamp { width: 60px !important; height: 60px !important; }
  .est-signature div[style*="font-size: 13px"] { font-size: 11px !important; }
  .est-signature div[style*="font-size: 12px"] { font-size: 10px !important; }
  .est-signature div[style*="font-size: 11px"] { font-size: 9px !important; }
  .est-footer { margin-top: 6px !important; padding-top: 6px !important; font-size: 9px !important; }
</style>
</head>
<body>
${cloned.outerHTML}
<script>
  window.onload = function() {
    setTimeout(function() {
      var paper = document.querySelector('.estimate-paper');
      var body = document.querySelector('.est-body');
      var bottom = document.querySelector('.est-bottom');
      if (paper && body && bottom) {
        // A4: 297mm - 12mm margin = 285mm ≈ 1077px @96dpi
        var pageH = 1077;
        var contentH = paper.scrollHeight;

        // 1) 컨텐츠가 페이지보다 크면 축소
        if (contentH > pageH) {
          var scale = pageH / contentH;
          paper.style.transform = 'scale(' + scale + ')';
          paper.style.transformOrigin = 'top left';
          paper.style.width = (100 / scale) + '%';
        } else {
          // 2) 페이지보다 작으면 — est-body를 페이지 높이에 맞추고 spacer로 하단 고정
          var headerH = paper.querySelector('.est-header') ? paper.querySelector('.est-header').offsetHeight : 0;
          var bodyTargetH = pageH - headerH;
          body.style.minHeight = bodyTargetH + 'px';
          // est-bottom 앞에 spacer 삽입
          var spacer = document.createElement('div');
          spacer.className = 'est-spacer';
          body.insertBefore(spacer, bottom);
        }
      }
      setTimeout(function() { window.print(); }, 200);
    }, 200);
    window.onafterprint = function() { window.close(); };
    setTimeout(function() { window.close(); }, 10000);
  };
<\/script>
</body>
</html>`;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printHTML);
      printWindow.document.close();
    } else {
      // 팝업 차단된 경우 - fallback으로 기존 window.print() 시도
      window.print();
    }
  }, []);

  const inputStyle: React.CSSProperties = {
    outline: "none", border: "none", background: "transparent",
    fontFamily: "inherit", fontSize: "inherit", color: "inherit",
    width: "100%", padding: "0",
  };

  return (
    <div className="estimate-wrapper" style={{
      fontFamily: "'Malgun Gothic','맑은 고딕','Apple SD Gothic Neo',sans-serif",
      background: "linear-gradient(135deg, #e8eaf6 0%, #ede7f6 100%)",
      minHeight: "100vh", padding: "28px 8px",
      touchAction: "pan-x pan-y pinch-zoom",
    }}>
      <style>{`
        @media print {
          .no-print { display: none !important; visibility: hidden !important; width: 0 !important; height: 0 !important; overflow: hidden !important; }
          .no-print-col { width: 0 !important; padding: 0 !important; overflow: hidden !important; }

          @page { size: A4 portrait; margin: 6mm; }

          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; box-sizing: border-box !important; }

          body, html {
            background: white !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            height: auto !important;
            min-height: unset !important;
          }

          .estimate-wrapper {
            background: white !important;
            min-height: auto !important;
            height: auto !important;
            padding: 0 !important;
            margin: 0 !important;
          }

          .print-area { padding: 0 !important; margin: 0 !important; }

          .estimate-paper {
            box-shadow: none !important;
            margin: 0 !important;
            border-radius: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            padding: 0 !important;
            overflow: visible !important;
            height: auto !important;
          }

          /* === 헤더 === */
          .est-header { padding: 10px 16px !important; }
          .est-header .est-title { font-size: 22px !important; letter-spacing: 6px !important; }
          .est-header .est-subtitle { font-size: 8px !important; margin-bottom: 3px !important; }
          .est-header input { font-size: 12px !important; }

          /* === 본문 === */
          .est-body { padding: 10px 16px !important; }

          /* === 수신/공급자 === */
          .est-parties { gap: 8px !important; margin-bottom: 6px !important; }
          .est-parties span, .est-parties input { font-size: 10px !important; line-height: 1.4 !important; }
          .est-parties .est-party-content { padding: 5px 8px !important; }
          .est-parties div[style*="padding: 12px 14px"] { padding: 5px 8px !important; }
          .est-parties div[style*="marginBottom: 5px"],
          .est-parties div[style*="margin-bottom: 5px"],
          .est-parties div[style*="marginBottom: 4px"],
          .est-parties div[style*="margin-bottom: 4px"] { margin-bottom: 1px !important; }

          /* === 합계금액 배너 === */
          .est-total-banner { padding: 6px 12px !important; margin-bottom: 6px !important; }
          .est-total-banner .est-total-amount { font-size: 16px !important; }
          .est-total-banner div[style*="font-size: 14px"] { font-size: 10px !important; }
          .est-total-banner div[style*="font-size: 11px"] { font-size: 9px !important; }

          /* === 품목 테이블 === */
          .est-table { margin-bottom: 4px !important; font-size: 10px !important; page-break-inside: avoid !important; }
          .est-table th { padding: 3px 5px !important; font-size: 9px !important; }
          .est-table td { padding: 2px 5px !important; font-size: 10px !important; }
          .est-table td input { font-size: 10px !important; }
          .est-table tr { page-break-inside: avoid !important; }
          .est-table td[style*="height: 34px"] { height: 16px !important; }

          /* === 합계 가로 === */
          .est-summary-row { margin-bottom: 4px !important; }
          .est-summary-row div[style*="padding: 10px 24px"] { padding: 5px 12px !important; min-width: 90px !important; }
          .est-summary-row span { font-size: 10px !important; }

          /* === 제품 사진 === */
          .est-photos { gap: 6px !important; margin-bottom: 6px !important; }
          .est-photos > div {
            aspect-ratio: 1 / 1 !important;
            min-height: 100px !important;
            max-height: none !important;
          }
          .est-photos img { object-fit: contain !important; }
          .est-photos-empty { display: none !important; }

          /* === 비고 === */
          .est-note { margin-bottom: 4px !important; }
          .est-note textarea { font-size: 9px !important; padding: 4px 8px !important; min-height: 20px !important; height: auto !important; }
          .est-note .est-note-header { padding: 3px 8px !important; font-size: 10px !important; }
          .est-note-empty { display: none !important; }

          /* === 서명+도장 === */
          .est-signature { margin-bottom: 2px !important; gap: 8px !important; margin-top: 4px !important; }
          .est-stamp { width: 55px !important; height: 55px !important; }
          .est-signature div[style*="font-size: 13px"] { font-size: 10px !important; }
          .est-signature div[style*="font-size: 12px"] { font-size: 9px !important; }
          .est-signature div[style*="font-size: 11px"] { font-size: 8px !important; }

          /* === 푸터 === */
          .est-footer { margin-top: 4px !important; padding-top: 4px !important; font-size: 8px !important; }
        }
        input, textarea { outline: none; border: none; background: transparent; font-family: inherit; }
        input:focus, textarea:focus { background: rgba(255,235,59,0.18); border-radius: 2px; }
        textarea { resize: none; }
        .item-row:hover { background: #f0f4ff !important; }
        .ctab { transition: all 0.15s; cursor: pointer; }
        .ctab:hover { opacity: 0.8; }
        .add-badge:hover { background: #c5cae9 !important; }
      `}</style>

      {/* 툴바 */}
      <div className="no-print" style={{ display: "flex", gap: "8px", marginBottom: "16px", justifyContent: "center", flexWrap: "wrap", maxWidth: "820px", margin: "0 auto 16px" }}>
        {[
          { label: "🖨️  인쇄 / PDF 저장", action: handlePrint, bg: "#1a237e" },
          { label: "+ 품목 추가", action: addItem, bg: "#2e7d32" },
        ].map(b => (
          <button key={b.label} onClick={b.action} style={{
            padding: "9px 18px", background: b.bg, color: "white",
            border: "none", borderRadius: "8px", cursor: "pointer",
            fontFamily: "inherit", fontSize: "clamp(11px, 2.8vw, 13px)", fontWeight: "bold",
            boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
            minWidth: "120px", flex: "1 1 auto", maxWidth: "220px",
          }}>{b.label}</button>
        ))}
        <label style={{
          padding: "9px 14px", background: vatIncluded ? "#e65100" : "#78909c",
          color: "white", borderRadius: "8px", cursor: "pointer",
          fontSize: "clamp(11px, 2.8vw, 13px)", fontWeight: "bold",
          boxShadow: "0 2px 8px rgba(0,0,0,0.15)", display: "flex", alignItems: "center", gap: "7px",
          minWidth: "120px", flex: "1 1 auto", maxWidth: "180px", justifyContent: "center",
        }}>
          <input type="checkbox" checked={vatIncluded} onChange={e => setVatIncluded(e.target.checked)}
            style={{ width: "15px", height: "15px", cursor: "pointer" }} />
          부가세 포함
        </label>
      </div>

      {/* 줌 컨트롤 */}
      <div className="no-print" style={{
        display: "flex", gap: "6px", justifyContent: "center", alignItems: "center",
        maxWidth: "820px", margin: "0 auto 12px",
      }}>
        <button onClick={zoomOut} style={{
          width: "32px", height: "32px", borderRadius: "6px",
          border: "1.5px solid #c5cae9", background: "white", color: "#1a237e",
          fontSize: "18px", fontWeight: "bold", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
        }}>－</button>
        <span style={{
          minWidth: "52px", textAlign: "center",
          fontSize: "13px", fontWeight: "bold", color: "#1a237e",
        }}>{Math.round(effectiveScale * 100)}%</span>
        <button onClick={zoomIn} style={{
          width: "32px", height: "32px", borderRadius: "6px",
          border: "1.5px solid #c5cae9", background: "white", color: "#1a237e",
          fontSize: "18px", fontWeight: "bold", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
        }}>＋</button>
        <button onClick={zoomReset} style={{
          height: "32px", borderRadius: "6px", padding: "0 12px",
          border: "1.5px solid #c5cae9", background: "white", color: "#7986cb",
          fontSize: "12px", fontWeight: "bold", cursor: "pointer",
          boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
        }}>초기화</button>
      </div>

      {/* 견적서 본문 (모바일 자동 축소 래퍼) */}
      <div ref={paperWrapperRef} style={{ width: "100%", maxWidth: "820px", margin: "0 auto", touchAction: "pan-x pan-y pinch-zoom" }}>
        <div style={{
          zoom: effectiveScale !== 1 ? effectiveScale : undefined,
        }}>
      <div ref={estimatePaperRef} className="estimate-paper" style={{
        minWidth: "680px", maxWidth: "820px", margin: "0 auto", background: "white",
        boxShadow: "0 8px 40px rgba(26,35,126,0.18)", borderRadius: "10px", overflow: "visible",
      }}>

        {/* 헤더 */}
        <div className="est-header" style={{
          background: "linear-gradient(135deg, #1a237e 0%, #283593 60%, #3949ab 100%)",
          padding: "24px 36px", display: "flex", justifyContent: "space-between", alignItems: "center",
          position: "relative", overflow: "hidden",
        }}>
          <div style={{ position: "absolute", right: "-40px", top: "-40px", width: "200px", height: "200px", borderRadius: "50%", background: "rgba(255,255,255,0.04)" }} />
          <div style={{ position: "absolute", right: "60px", bottom: "-30px", width: "120px", height: "120px", borderRadius: "50%", background: "rgba(255,255,255,0.04)" }} />
          <div style={{ position: "relative" }}>
            <div className="est-subtitle" style={{ color: "#90caf9", fontSize: "11px", letterSpacing: "5px", marginBottom: "6px" }}>ESTIMATE</div>
            <div className="est-title" style={{ color: "white", fontSize: "30px", fontWeight: "bold", letterSpacing: "10px" }}>견 적 서</div>
          </div>
          <div style={{ textAlign: "right", color: "white", position: "relative" }}>
            <div style={{ marginBottom: "8px" }}>
              <div style={{ fontSize: "10px", color: "#90caf9", letterSpacing: "1px" }}>견적번호</div>
              <input value={estimateNo} onChange={e => setEstimateNo(e.target.value)}
                style={{ ...inputStyle, fontSize: "18px", fontWeight: "bold", color: "white", textAlign: "right", width: "140px" }} />
            </div>
            <div>
              <div style={{ fontSize: "10px", color: "#90caf9", letterSpacing: "1px" }}>견적일자</div>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                style={{ ...inputStyle, fontSize: "13px", color: "white", textAlign: "right", width: "140px", colorScheme: "dark" }} />
            </div>
          </div>
        </div>

        <div className="est-body" style={{ padding: "28px 36px" }}>

          {/* 수신/공급자 */}
          <div className="est-parties" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "18px", marginBottom: "22px" }}>

            {/* 수신처 */}
            <div style={{ border: "2px solid #1a237e", borderRadius: "8px", overflow: "hidden" }}>
              <div style={{ background: "#1a237e", color: "white", padding: "7px 14px", fontSize: "12px", fontWeight: "bold", letterSpacing: "3px" }}>수 신</div>
              <div style={{ padding: "12px 14px" }}>
                {/* 거래처명 — 검색 가능 */}
                <div style={{ display: "flex", marginBottom: "5px", fontSize: "12.5px", position: "relative" }}>
                  <span style={{ color: "#888", minWidth: "58px", flexShrink: 0 }}>거래처명</span>
                  <span style={{ color: "#555", marginRight: "5px" }}>:</span>
                  <div style={{ flex: 1, position: "relative" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      <input
                        value={clientSearchOpen ? clientSearchQuery : client.name}
                        onChange={e => {
                          if (clientSearchOpen) {
                            setClientSearchQuery(e.target.value);
                          } else {
                            setClient({ ...client, name: e.target.value });
                          }
                        }}
                        onFocus={() => {
                          setClientSearchOpen(true);
                          setClientSearchQuery(client.name);
                        }}
                        style={{ ...inputStyle, fontSize: "12.5px", color: "#1a237e", fontWeight: "bold" }}
                        placeholder="거래처 검색/입력"
                      />
                      <span
                        className="no-print"
                        onClick={() => {
                          if (clientSearchOpen) {
                            setClientSearchOpen(false);
                            setClientSearchQuery("");
                          } else {
                            setClientSearchOpen(true);
                            setClientSearchQuery(client.name);
                          }
                        }}
                        style={{ cursor: "pointer", fontSize: "13px", color: "#7986cb", flexShrink: 0 }}
                        title="거래처 검색"
                      >🔍</span>
                    </div>
                    {clientSearchOpen && filteredDbClients.length > 0 && (
                      <div ref={clientSearchRef} style={{
                        position: "absolute", top: "100%", left: "-62px", right: 0, zIndex: 100,
                        background: "white", border: "1.5px solid #c5cae9", borderRadius: "0 0 8px 8px",
                        boxShadow: "0 6px 20px rgba(26,35,126,0.18)", maxHeight: "200px", overflowY: "auto",
                      }}>
                        {filteredDbClients.map(dc => (
                          <div key={dc.id}
                            onClick={() => selectDbClient(dc)}
                            style={{
                              padding: "7px 10px", cursor: "pointer", fontSize: "12px",
                              display: "flex", flexDirection: "column", gap: "1px",
                              borderBottom: "1px solid #f0f0f5", transition: "background 0.1s",
                            }}
                            onMouseEnter={e => (e.currentTarget.style.background = "#e8eaf6")}
                            onMouseLeave={e => (e.currentTarget.style.background = "white")}
                          >
                            <div style={{ fontWeight: "bold", color: "#1a237e" }}>{dc.name}</div>
                            {dc.address && <div style={{ fontSize: "10.5px", color: "#999" }}>{dc.address}</div>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                {/* 나머지 필드: 주소, 담당자, 연락처 */}
                {([["주소", "address"], ["담당자", "contact"], ["연락처", "tel"]] as const).map(([label, field]) => (
                  <div key={field} style={{ display: "flex", marginBottom: "5px", fontSize: "12.5px" }}>
                    <span style={{ color: "#888", minWidth: "58px", flexShrink: 0 }}>{label}</span>
                    <span style={{ color: "#555", marginRight: "5px" }}>:</span>
                    <input value={client[field]} onChange={e => setClient({ ...client, [field]: e.target.value })}
                      style={{ ...inputStyle, fontSize: "12.5px", color: "#222" }} />
                  </div>
                ))}
              </div>
            </div>

            {/* 공급자 탭 */}
            <div style={{ border: "1.5px solid #e0e4ee", borderRadius: "8px", overflow: "hidden", display: "flex", flexDirection: "column" }}>

              {/* 탭 헤더 */}
              <div style={{ background: "#f5f6fa", borderBottom: "1.5px solid #e0e4ee", display: "flex", alignItems: "center", minHeight: "38px", padding: "0 10px", gap: "6px" }}>

                {/* 공급자 라벨 (맨 앞) */}
                <span style={{
                  fontSize: "11px", fontWeight: "bold",
                  color: "#1a237e", letterSpacing: "2px", flexShrink: 0,
                  marginRight: "2px",
                }}>공 급 자</span>

                {/* 원형 번호 배지 나열 */}
                {companies.map((c, idx) => {
                  const isActive = c.id === activeCompanyId;
                  const circledNums = ["①", "②", "③", "④", "⑤"];
                  return (
                    <div
                      key={c.id}
                      className="ctab"
                      onClick={() => setActiveCompanyId(c.id)}
                      title={c.name || `공급자 ${idx + 1}`}
                      style={{
                        width: "26px", height: "26px", borderRadius: "50%",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        background: isActive ? "#1a237e" : "#e0e4ee",
                        color: isActive ? "white" : "#aab0c0",
                        fontSize: "14px",
                        fontWeight: isActive ? "bold" : "normal",
                        cursor: "pointer",
                        opacity: isActive ? 1 : 0.65,
                        transition: "all 0.15s",
                        flexShrink: 0,
                        boxShadow: isActive ? "0 2px 6px rgba(26,35,126,0.3)" : "none",
                      }}
                    >
                      {circledNums[idx] || idx + 1}
                    </div>
                  );
                })}

                {/* + 점선 원형 버튼 */}
                {companies.length < 5 && (
                  <div
                    className="no-print add-badge ctab"
                    onClick={addCompany}
                    title="공급자 추가 (최대 5개)"
                    style={{
                      width: "26px", height: "26px", borderRadius: "50%",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: "transparent",
                      color: "#9fa8da", fontSize: "15px", fontWeight: "bold",
                      border: "1.5px dashed #9fa8da", flexShrink: 0,
                      cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                  >+</div>
                )}

                {/* ✕ 삭제 버튼 (우측 끝) */}
                {companies.length > 1 && (
                  <div
                    className="no-print"
                    onClick={() => removeCompany(activeCompanyId)}
                    title="현재 공급자 삭제"
                    style={{
                      marginLeft: "auto", flexShrink: 0,
                      width: "22px", height: "22px", borderRadius: "50%",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: "#fff0f0", border: "1px solid #ffcdd2",
                      color: "#e53935", fontSize: "12px", fontWeight: "bold",
                      cursor: "pointer", transition: "all 0.15s",
                    }}
                  >✕</div>
                )}
              </div>

              {/* 공급자 내용 */}
              <div style={{ padding: "12px 14px", display: "flex", gap: "10px", alignItems: "flex-start", flex: 1 }}>
                <div style={{ flex: 1 }}>
                  {([["상호", "name"], ["대표자", "ceo"], ["사업자번호", "bizNo"], ["주소", "address"], ["전화", "tel"]] as const).map(([label, field]) => (
                    <div key={field} style={{ display: "flex", marginBottom: "4px", fontSize: "12.5px" }}>
                      <span style={{ color: "#888", minWidth: "68px", flexShrink: 0 }}>{label}</span>
                      <span style={{ color: "#555", marginRight: "5px" }}>:</span>
                      <input
                        value={activeCompany[field]}
                        onChange={e => updateActiveCompany(field, e.target.value)}
                        style={{ ...inputStyle, fontSize: "12.5px", color: "#222" }}
                      />
                    </div>
                  ))}
                </div>
                <div className="no-print" style={{ flexShrink: 0, paddingTop: "2px" }}>
                  <ImageUploadBox
                    label="도장"
                    value={activeCompany.stampImg}
                    onChange={v => updateActiveCompany("stampImg", v)}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 합계 금액 배너 */}
          <div className="est-total-banner" style={{
            background: "linear-gradient(135deg, #e8eaf6 0%, #ede7f6 100%)",
            border: "2px solid #3949ab", borderRadius: "8px",
            padding: "14px 22px", marginBottom: "20px",
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <div style={{ fontSize: "14px", fontWeight: "bold", color: "#283593" }}>아래와 같이 견적합니다.</div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "11px", color: "#7986cb", marginBottom: "2px" }}>합계금액 (VAT {vatIncluded ? "포함" : "별도"})</div>
              <div className="est-total-amount" style={{ fontSize: "24px", fontWeight: "bold", color: "#1a237e", letterSpacing: "-0.5px" }}>
                {won(total)} <span style={{ fontSize: "14px", fontWeight: "normal" }}>원</span>
              </div>
            </div>
          </div>

          {/* 품목 테이블 */}
          <table className="est-table" style={{ width: "100%", borderCollapse: "collapse", marginBottom: "18px", fontSize: "12.5px" }}>
            <thead>
              <tr style={{ background: "linear-gradient(90deg, #1a237e, #3949ab)", color: "white" }}>
                {["No", "품목명", "수량", "단가", "금액", "비고", ""].map((h, i) => (
                  <th key={i} className={i === 6 ? "no-print" : ""} style={{
                    padding: "9px 8px",
                    textAlign: i === 0 || i === 2 || i === 6 ? "center" : i >= 3 && i <= 4 ? "right" : "left",
                    fontWeight: "600", fontSize: "12px", letterSpacing: "0.5px",
                    width: [30, undefined, 48, 100, 110, 80, 36][i],
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={item.id} className="item-row" style={{
                  borderBottom: "1px solid #eaecf4",
                  background: idx % 2 === 0 ? "white" : "#f8f9fd",
                  transition: "background 0.15s",
                }}>
                  <td style={{ padding: "8px", textAlign: "center", color: "#aaa", fontSize: "11px" }}>{idx + 1}</td>
                  <td style={{ padding: "8px", position: "relative" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      <input value={searchingItemId === item.id ? searchQuery : item.name}
                        onChange={e => {
                          if (searchingItemId === item.id) {
                            setSearchQuery(e.target.value);
                          } else {
                            updateItem(item.id, "name", e.target.value);
                          }
                        }}
                        onFocus={() => {
                          setSearchingItemId(item.id);
                          setSearchQuery(item.name);
                        }}
                        style={{ ...inputStyle, fontSize: "12.5px" }} placeholder="품목명 검색/입력" />
                      <span
                        className="no-print"
                        onClick={() => {
                          if (searchingItemId === item.id) {
                            setSearchingItemId(null);
                            setSearchQuery("");
                          } else {
                            setSearchingItemId(item.id);
                            setSearchQuery(item.name);
                          }
                        }}
                        style={{ cursor: "pointer", fontSize: "13px", color: "#7986cb", flexShrink: 0 }}
                        title="품목 검색"
                      >🔍</span>
                    </div>
                    {/* 검색 드롭다운 */}
                    {searchingItemId === item.id && filteredDbItems.length > 0 && (
                      <div ref={searchRef} style={{
                        position: "absolute", top: "100%", left: 0, right: 0, zIndex: 100,
                        background: "white", border: "1.5px solid #c5cae9", borderRadius: "0 0 8px 8px",
                        boxShadow: "0 6px 20px rgba(26,35,126,0.18)", maxHeight: "200px", overflowY: "auto",
                      }}>
                        {filteredDbItems.map(di => (
                          <div key={di.id}
                            onClick={() => selectDbItem(item.id, di)}
                            style={{
                              padding: "7px 10px", cursor: "pointer", fontSize: "12px",
                              display: "flex", alignItems: "center", gap: "8px",
                              borderBottom: "1px solid #f0f0f5", transition: "background 0.1s",
                            }}
                            onMouseEnter={e => (e.currentTarget.style.background = "#e8eaf6")}
                            onMouseLeave={e => (e.currentTarget.style.background = "white")}
                          >
                            {di.photo_url && (
                              <img src={di.photo_url} alt="" style={{ width: "28px", height: "28px", borderRadius: "4px", objectFit: "cover", flexShrink: 0, border: "1px solid #e0e4ee" }} />
                            )}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: "bold", color: "#1a237e", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{di.name}</div>
                              <div style={{ fontSize: "10.5px", color: "#999" }}>₩{(di.price || 0).toLocaleString()} {di.category ? `· ${di.category}` : ""}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: "8px", textAlign: "center" }}>
                    <input type="number" value={item.qty} onChange={e => updateItem(item.id, "qty", Math.max(1, Number(e.target.value)))}
                      style={{ ...inputStyle, width: "42px", textAlign: "center", fontSize: "12.5px" }} min="1" />
                  </td>
                  <td style={{ padding: "8px", textAlign: "right" }}>
                    <input type="number" value={item.price} onChange={e => updateItem(item.id, "price", Number(e.target.value))}
                      style={{ ...inputStyle, textAlign: "right", fontSize: "12.5px" }} />
                  </td>
                  <td style={{ padding: "8px", textAlign: "right", fontWeight: "bold", color: "#1a237e" }}>
                    {(item.qty * item.price).toLocaleString()}
                  </td>
                  <td style={{ padding: "8px" }}>
                    <input value={item.note} onChange={e => updateItem(item.id, "note", e.target.value)}
                      style={{ ...inputStyle, fontSize: "11.5px", color: "#888" }} placeholder="비고" />
                  </td>
                  <td className="no-print" style={{ padding: "8px", textAlign: "center" }}>
                    <button onClick={() => removeItem(item.id)} style={{
                      background: "#fff0f0", border: "1px solid #ffcdd2",
                      borderRadius: "4px", padding: "2px 7px", cursor: "pointer",
                      color: "#e53935", fontSize: "12px", lineHeight: 1.5,
                    }}>✕</button>
                  </td>
                </tr>
              ))}
              {items.length < 5 && Array.from({ length: 5 - items.length }).map((_, i) => (
                <tr key={"empty-" + i} style={{ borderBottom: "1px solid #eaecf4" }}>
                  {Array.from({ length: 7 }).map((_, j) => (
                    <td key={j} className={j === 6 ? "no-print" : ""} style={{ padding: "8px", height: "34px" }} />
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          {/* 합계 가로 */}
          <div className="est-summary-row" style={{ display: "flex", justifyContent: "flex-end", marginBottom: "22px" }}>
            <div style={{ display: "flex", borderRadius: "8px", overflow: "hidden", border: "1.5px solid #e0e4ee" }}>
              {([
                ["공급가액", subtotal, false],
                vatIncluded ? ["부가세 (10%)", vat, false] : null,
                ["합 계 금 액", total, true],
              ].filter((x): x is [string, number, boolean] => x !== null)).map(([label, val, isTotal], i) => (
                <div key={label} style={{
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  padding: "10px 24px",
                  background: isTotal ? "linear-gradient(135deg, #1a237e, #3949ab)" : i % 2 === 0 ? "white" : "#f8f9fd",
                  color: isTotal ? "white" : "#333",
                  borderLeft: i > 0 ? "1.5px solid #e0e4ee" : "none",
                  minWidth: "160px",
                }}>
                  <span style={{ fontSize: "11px", color: isTotal ? "#90caf9" : "#999", marginBottom: "4px" }}>{label}</span>
                  <span style={{ fontSize: isTotal ? "15px" : "14px", fontWeight: isTotal ? "bold" : "500" }}>{won(val)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 하단 영역: 사진/비고/서명/푸터 — PDF에서 페이지 하단 고정 */}
          <div className="est-bottom">

          {/* 제품 사진 박스 3개 — 품목 1,2,3의 사진 자동 표시 */}
          <div className={`est-photos ${items.slice(0,3).some(i => i?.photoUrl) ? '' : 'est-photos-empty'}`} style={{ display: "flex", gap: "12px", marginBottom: "22px" }}>
            {[0, 1, 2].map(i => {
              const photo = items[i]?.photoUrl || null;
              const itemName = items[i]?.name || "";
              return (
                <div key={i} style={{
                  flex: 1, aspectRatio: "1 / 1",
                  border: "1.5px solid #e0e4ee", borderRadius: "8px", background: "#f8f9fd",
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  overflow: "hidden", position: "relative",
                }}>
                  {photo ? (
                    <>
                      <img src={photo} alt={itemName} style={{
                        width: "100%", height: "100%", objectFit: "contain", padding: "8px",
                      }} />
                      <div style={{
                        position: "absolute", bottom: 0, left: 0, right: 0,
                        background: "linear-gradient(transparent, rgba(0,0,0,0.5))",
                        padding: "14px 8px 6px", textAlign: "center",
                      }}>
                        <span style={{ fontSize: "10.5px", color: "white", fontWeight: "bold",
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>
                          {itemName}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div style={{ textAlign: "center", padding: "10px" }}>
                      <div style={{ fontSize: "24px", color: "#d0d4e0", marginBottom: "6px" }}>📷</div>
                      <div style={{ fontSize: "10px", color: "#bbb", lineHeight: 1.4 }}>
                        {itemName ? `${i + 1}. ${itemName}` : `품목 ${i + 1}`}
                        <br />제품 사진
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* 비고 */}
          <div className={`est-note ${note.trim() ? '' : 'est-note-empty'}`} style={{ border: "1.5px solid #e0e4ee", borderRadius: "8px", overflow: "hidden", marginBottom: "22px" }}>
            <div className="est-note-header" style={{ background: "#f5f6fa", padding: "7px 14px", fontSize: "12px", fontWeight: "bold", color: "#555", borderBottom: "1px solid #e0e4ee", letterSpacing: "1px" }}>
              비고 / 특이사항
            </div>
            <textarea value={note} onChange={e => setNote(e.target.value)}
              rows={3} style={{ width: "100%", padding: "10px 14px", fontSize: "12.5px", color: "#555", boxSizing: "border-box", lineHeight: 1.7 }} />
          </div>

          {/* 서명 + 도장 영역 */}
          <div className="est-signature" style={{ display: "flex", justifyContent: "flex-end", alignItems: "flex-end", gap: "16px", marginBottom: "8px" }}>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "13px", color: "#333", fontWeight: "bold", marginBottom: "4px" }}>
                {activeCompany.name}
              </div>
              <div style={{ fontSize: "12px", color: "#666", marginBottom: "2px" }}>
                대표이사 &nbsp; {activeCompany.ceo}
              </div>
              <div style={{ fontSize: "11px", color: "#bbb", marginTop: "8px" }}>
                본 견적서는 인쇄 후 서명하여 사용하시기 바랍니다.
              </div>
            </div>
            {/* 도장 이미지 */}
            <div className="est-stamp" style={{
              width: "90px", height: "90px",
              flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              position: "relative",
            }}>
              {activeCompany.stampImg ? (
                <>
                  <img
                    src={activeCompany.stampImg}
                    alt="도장"
                    style={{
                      width: "100%", height: "100%",
                      objectFit: "contain",
                      opacity: 0.9,
                      filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.08))",
                    }}
                  />
                  <div
                    className="no-print"
                    onClick={() => downloadPng(activeCompany.stampImg!, `${activeCompany.name || '도장'}_투명배경.png`)}
                    style={{
                      position: "absolute", bottom: "0px", right: "0px",
                      background: "#1a237e", color: "white",
                      borderRadius: "4px", padding: "2px 6px",
                      fontSize: "9px", cursor: "pointer",
                      boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
                      opacity: 0.7, transition: "opacity 0.2s",
                      whiteSpace: "nowrap",
                    }}
                    title="투명 배경 PNG 파일로 저장"
                  >💾 PNG</div>
                </>
              ) : (
                <div style={{
                  width: "100%", height: "100%",
                  border: "2px dashed #d0d4e0",
                  borderRadius: "50%",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexDirection: "column", gap: "2px",
                }}>
                  <span style={{ fontSize: "20px", color: "#d0d4e0" }}>印</span>
                  <span className="no-print" style={{ fontSize: "9px", color: "#ccc" }}>공급자에서 등록</span>
                </div>
              )}
            </div>
          </div>

          {/* 푸터 */}
          <div className="est-footer" style={{ marginTop: "20px", paddingTop: "14px", borderTop: "1px solid #e8eaf0", textAlign: "center", fontSize: "11px", color: "#bbb" }}>
            {activeCompany.name} &nbsp;|&nbsp; 대표: {activeCompany.ceo} &nbsp;|&nbsp; 사업자번호: {activeCompany.bizNo} &nbsp;|&nbsp; {activeCompany.tel} &nbsp;|&nbsp; {activeCompany.email}
          </div>

          </div>{/* end est-bottom */}
        </div>
      </div>
        </div>
      </div>
    </div>
  );
}
