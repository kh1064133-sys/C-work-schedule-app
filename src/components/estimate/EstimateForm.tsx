'use client';

import { useState, useRef } from "react";

interface Item {
  id: number;
  name: string;
  qty: number;
  price: number;
  note: string;
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
  { id: 1, name: "(서통)타워1차_ABCD 도어폰 교체", qty: 1, price: 630000, note: "AS 포함" },
  { id: 2, name: "AL3M 미화모터락", qty: 2, price: 850000, note: "" },
  { id: 3, name: "도어크루저 미화(노출형)", qty: 1, price: 480000, note: "" },
];

const newCompany = (id: number): Company => ({
  id, name: "", ceo: "", bizNo: "", address: "", tel: "", email: "", stampImg: null,
});

function ImageUploadBox({ label, value, onChange }: { label: string; value: string | null; onChange: (v: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => onChange(ev.target?.result as string);
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

export default function EstimateForm() {
  const [items, setItems] = useState<Item[]>(initialItems);
  const [companies, setCompanies] = useState<Company[]>([
    { id: 1, name: "(주)서통시큐리티", ceo: "홍길동", bizNo: "123-45-67890", address: "서울시 강남구 도곡동 467", tel: "02-1234-5678", email: "info@seotong.co.kr", stampImg: null },
  ]);
  const [activeCompanyId, setActiveCompanyId] = useState(1);
  const [client, setClient] = useState<Client>({ name: "(서통)타워1차_ABCD", address: "서울시 강남구 도곡동 467", contact: "김담당", tel: "010-1234-5678" });
  const [estimateNo, setEstimateNo] = useState("2026-001");
  const [date, setDate] = useState("2026-02-22");
  const [vatIncluded, setVatIncluded] = useState(true);
  const [note, setNote] = useState("• 본 견적서는 발행일로부터 30일간 유효합니다.\n• 설치비 별도 문의 바랍니다.");

  const activeCompany = companies.find(c => c.id === activeCompanyId) || companies[0];
  const updateActiveCompany = (field: keyof Company, value: string | null) =>
    setCompanies(prev => prev.map(c => c.id === activeCompanyId ? { ...c, [field]: value } : c));

  const addCompany = () => {
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

  const addItem = () => setItems([...items, { id: Date.now(), name: "", qty: 1, price: 0, note: "" }]);
  const removeItem = (id: number) => setItems(items.filter(i => i.id !== id));
  const updateItem = (id: number, field: keyof Item, value: string | number) => setItems(items.map(i => i.id === id ? { ...i, [field]: value } : i));
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
                {([["거래처명", "name"], ["주소", "address"], ["담당자", "contact"], ["연락처", "tel"]] as const).map(([label, field]) => (
                  <div key={field} style={{ display: "flex", marginBottom: "5px", fontSize: "12.5px" }}>
                    <span style={{ color: "#888", minWidth: "58px", flexShrink: 0 }}>{label}</span>
                    <span style={{ color: "#555", marginRight: "5px" }}>:</span>
                    <input value={client[field]} onChange={e => setClient({ ...client, [field]: e.target.value })}
                      style={{ ...inputStyle, fontSize: "12.5px", color: field === "name" ? "#1a237e" : "#222", fontWeight: field === "name" ? "bold" : "normal" }} />
                  </div>
                ))}
              </div>
            </div>

            {/* 공급자 탭 */}
            <div style={{ border: "1.5px solid #e0e4ee", borderRadius: "8px", overflow: "hidden", display: "flex", flexDirection: "column" }}>

              {/* 탭 헤더 */}
              <div style={{ background: "#f5f6fa", borderBottom: "1.5px solid #e0e4ee", display: "flex", alignItems: "center", flexWrap: "wrap", minHeight: "38px" }}>

                {companies.map((c, idx) => (
                  <div
                    key={c.id}
                    className="ctab"
                    onClick={() => setActiveCompanyId(c.id)}
                    style={{
                      display: "flex", alignItems: "center", gap: "4px",
                      padding: "6px 10px 6px 8px",
                      background: c.id === activeCompanyId ? "white" : "transparent",
                      borderRight: "1px solid #e0e4ee",
                      borderBottom: c.id === activeCompanyId ? "2px solid white" : "none",
                      marginBottom: c.id === activeCompanyId ? "-1.5px" : "0",
                      position: "relative", zIndex: c.id === activeCompanyId ? 2 : 1,
                    }}
                  >
                    {/* 번호 뱃지 */}
                    <span style={{
                      background: c.id === activeCompanyId ? "#1a237e" : "#90a4ae",
                      color: "white", borderRadius: "50%",
                      width: "17px", height: "17px", fontSize: "10px", fontWeight: "bold",
                      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                    }}>{idx + 1}</span>
                    <span style={{
                      fontSize: "11px", maxWidth: "55px",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      color: c.id === activeCompanyId ? "#1a237e" : "#888",
                      fontWeight: c.id === activeCompanyId ? "bold" : "normal",
                    }}>
                      {c.name || "공급자"}
                    </span>
                    {companies.length > 1 && (
                      <span
                        className="no-print"
                        onClick={e => { e.stopPropagation(); removeCompany(c.id); }}
                        style={{ fontSize: "10px", color: "#e53935", cursor: "pointer", padding: "0 1px", lineHeight: 1 }}
                      >✕</span>
                    )}
                  </div>
                ))}

                {/* + 뱃지 */}
                <div
                  className="no-print add-badge ctab"
                  onClick={addCompany}
                  title="공급자 추가"
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center",
                    width: "24px", height: "24px", margin: "0 6px",
                    background: "#e8eaf6", borderRadius: "6px",
                    color: "#1a237e", fontSize: "15px", fontWeight: "bold",
                    border: "1.5px dashed #9fa8da", flexShrink: 0,
                    transition: "background 0.15s",
                  }}
                >+</div>

                <span style={{
                  marginLeft: "auto", fontSize: "11px", fontWeight: "bold",
                  color: "#888", letterSpacing: "2px", paddingRight: "10px",
                }}>공 급 자</span>
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
                  <td style={{ padding: "8px" }}>
                    <input value={item.name} onChange={e => updateItem(item.id, "name", e.target.value)}
                      style={{ ...inputStyle, fontSize: "12.5px" }} placeholder="품목명 입력" />
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

          {/* 정사각형 박스 3개 */}
          <div style={{ display: "flex", gap: "12px", marginBottom: "22px" }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{
                flex: 1, aspectRatio: "1 / 1",
                border: "1.5px solid #e0e4ee", borderRadius: "8px", background: "#f8f9fd",
              }} />
            ))}
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
