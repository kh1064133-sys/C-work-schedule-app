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

function removeWhiteBg(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = document.createElement("img");
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(dataUrl); return; }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      let imageData: ImageData;
      try {
        imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      } catch {
        resolve(dataUrl); return;
      }

      const d = imageData.data;
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i], g = d[i + 1], b = d[i + 2];
        // 밝기 + 색상 거리 기반: 흰색(255,255,255)에서 얼마나 먼지 계산
        const dist = Math.sqrt((255 - r) ** 2 + (255 - g) ** 2 + (255 - b) ** 2);
        // dist가 작을수록 흰색에 가까움 (최대 ~441)
        if (dist < 45) {
          // 거의 흰색 → 완전 투명
          d[i + 3] = 0;
        } else if (dist < 80) {
          // 경계 영역 → dist에 비례하는 알파
          d[i + 3] = Math.round(((dist - 45) / 35) * 255);
        }
        // dist >= 80 → 도장 잉크 부분, 그대로 유지
      }
      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
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
              style={{
                position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)",
                display: "flex", alignItems: "center", justifyContent: "center",
                opacity: 0, transition: "opacity 0.2s", fontSize: "11px", color: "white",
              }}
              onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.opacity = '1'}
              onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.opacity = '0'}
            >변경</div>
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

  // localStorage에 자동 저장
  useEffect(() => { saveToStorage(`${STORAGE_KEY}_companies`, companies); }, [companies]);
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

  const inputStyle: React.CSSProperties = {
    outline: "none", border: "none", background: "transparent",
    fontFamily: "inherit", fontSize: "inherit", color: "inherit",
    width: "100%", padding: "0",
  };

  return (
    <div style={{
      fontFamily: "'Malgun Gothic','맑은 고딕','Apple SD Gothic Neo',sans-serif",
      background: "linear-gradient(135deg, #e8eaf6 0%, #ede7f6 100%)",
      minHeight: "100vh", padding: "28px 16px",
    }}>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .estimate-paper { box-shadow: none !important; margin: 0 !important; border-radius: 0 !important; }
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
      <div className="no-print" style={{ display: "flex", gap: "10px", marginBottom: "20px", justifyContent: "center", flexWrap: "wrap" }}>
        {[
          { label: "🖨️  인쇄 / PDF 저장", action: () => window.print(), bg: "#1a237e" },
          { label: "+ 품목 추가", action: addItem, bg: "#2e7d32" },
        ].map(b => (
          <button key={b.label} onClick={b.action} style={{
            padding: "9px 22px", background: b.bg, color: "white",
            border: "none", borderRadius: "8px", cursor: "pointer",
            fontFamily: "inherit", fontSize: "13px", fontWeight: "bold",
            boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
          }}>{b.label}</button>
        ))}
        <label style={{
          padding: "9px 18px", background: vatIncluded ? "#e65100" : "#78909c",
          color: "white", borderRadius: "8px", cursor: "pointer",
          fontSize: "13px", fontWeight: "bold",
          boxShadow: "0 2px 8px rgba(0,0,0,0.15)", display: "flex", alignItems: "center", gap: "7px",
        }}>
          <input type="checkbox" checked={vatIncluded} onChange={e => setVatIncluded(e.target.checked)}
            style={{ width: "15px", height: "15px", cursor: "pointer" }} />
          부가세 포함
        </label>
      </div>

      {/* 견적서 본문 */}
      <div className="estimate-paper" style={{
        maxWidth: "820px", margin: "0 auto", background: "white",
        boxShadow: "0 8px 40px rgba(26,35,126,0.18)", borderRadius: "10px", overflow: "hidden",
      }}>

        {/* 헤더 */}
        <div style={{
          background: "linear-gradient(135deg, #1a237e 0%, #283593 60%, #3949ab 100%)",
          padding: "24px 36px", display: "flex", justifyContent: "space-between", alignItems: "center",
          position: "relative", overflow: "hidden",
        }}>
          <div style={{ position: "absolute", right: "-40px", top: "-40px", width: "200px", height: "200px", borderRadius: "50%", background: "rgba(255,255,255,0.04)" }} />
          <div style={{ position: "absolute", right: "60px", bottom: "-30px", width: "120px", height: "120px", borderRadius: "50%", background: "rgba(255,255,255,0.04)" }} />
          <div style={{ position: "relative" }}>
            <div style={{ color: "#90caf9", fontSize: "11px", letterSpacing: "5px", marginBottom: "6px" }}>ESTIMATE</div>
            <div style={{ color: "white", fontSize: "30px", fontWeight: "bold", letterSpacing: "10px" }}>견 적 서</div>
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

        <div style={{ padding: "28px 36px" }}>

          {/* 수신/공급자 */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "18px", marginBottom: "22px" }}>

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
                <div style={{ flexShrink: 0, paddingTop: "2px" }}>
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
          <div style={{
            background: "linear-gradient(135deg, #e8eaf6 0%, #ede7f6 100%)",
            border: "2px solid #3949ab", borderRadius: "8px",
            padding: "14px 22px", marginBottom: "20px",
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <div style={{ fontSize: "14px", fontWeight: "bold", color: "#283593" }}>아래와 같이 견적합니다.</div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "11px", color: "#7986cb", marginBottom: "2px" }}>합계금액 (VAT {vatIncluded ? "포함" : "별도"})</div>
              <div style={{ fontSize: "24px", fontWeight: "bold", color: "#1a237e", letterSpacing: "-0.5px" }}>
                {won(total)} <span style={{ fontSize: "14px", fontWeight: "normal" }}>원</span>
              </div>
            </div>
          </div>

          {/* 품목 테이블 */}
          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "18px", fontSize: "12.5px" }}>
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
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "22px" }}>
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

          {/* 제품 사진 박스 3개 — 품목 1,2,3의 사진 자동 표시 */}
          <div style={{ display: "flex", gap: "12px", marginBottom: "22px" }}>
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
          <div style={{ border: "1.5px solid #e0e4ee", borderRadius: "8px", overflow: "hidden", marginBottom: "22px" }}>
            <div style={{ background: "#f5f6fa", padding: "7px 14px", fontSize: "12px", fontWeight: "bold", color: "#555", borderBottom: "1px solid #e0e4ee", letterSpacing: "1px" }}>
              비고 / 특이사항
            </div>
            <textarea value={note} onChange={e => setNote(e.target.value)}
              rows={3} style={{ width: "100%", padding: "10px 14px", fontSize: "12.5px", color: "#555", boxSizing: "border-box", lineHeight: 1.7 }} />
          </div>

          {/* 서명 안내 */}
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <div style={{ fontSize: "11px", color: "#bbb" }}>본 견적서는 인쇄 후 서명하여 사용하시기 바랍니다.</div>
          </div>

          {/* 푸터 */}
          <div style={{ marginTop: "20px", paddingTop: "14px", borderTop: "1px solid #e8eaf0", textAlign: "center", fontSize: "11px", color: "#bbb" }}>
            {activeCompany.name} &nbsp;|&nbsp; 대표: {activeCompany.ceo} &nbsp;|&nbsp; 사업자번호: {activeCompany.bizNo} &nbsp;|&nbsp; {activeCompany.tel} &nbsp;|&nbsp; {activeCompany.email}
          </div>
        </div>
      </div>
    </div>
  );
}
