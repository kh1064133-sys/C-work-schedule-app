'use client';

/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { createClient } from '@/lib/supabase/client';

type DoorVerificationCode = {
  id: string;
  phone: string;
  code: string;
  created_at: string;
  verified: boolean;
  customer_name: string | null;
  apartment_name: string | null;
  consent_agreed: boolean;
  signature_data_url: string | null;
  submitted_at: string | null;
};

const DOOR_VERIFICATION_CONFIRM_BASE_URL = 'https://c-work-schedule-app.vercel.app';

function createSevenDigitCode() {
  return String(Math.floor(1000000 + Math.random() * 9000000));
}

function formatDateTime(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function getConfirmUrl(code: string) {
  return `${DOOR_VERIFICATION_CONFIRM_BASE_URL}/door-verification/confirm/?code=${encodeURIComponent(code)}`;
}

async function createQrDataUrl(code: string) {
  return QRCode.toDataURL(getConfirmUrl(code), {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 320,
  });
}

export function DoorVerificationPage() {
  const supabase = useMemo(() => createClient(), []);
  const [phone, setPhone] = useState('');
  const [lastCode, setLastCode] = useState('');
  const [lastQrDataUrl, setLastQrDataUrl] = useState('');
  const [history, setHistory] = useState<DoorVerificationCode[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const loadHistory = useCallback(async () => {
    setIsLoading(true);

    const { data, error } = await supabase
      .from('door_verification_codes')
      .select('id, phone, code, created_at, verified, customer_name, apartment_name, consent_agreed, signature_data_url, submitted_at')
      .order('created_at', { ascending: false })
      .limit(30);

    if (error) {
      setMessage(`최근 발송 이력을 불러오지 못했습니다. ${error.message}`);
      setIsLoading(false);
      return;
    }

    setHistory((data || []) as DoorVerificationCode[]);
    setIsLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const createAndSaveCode = async (targetPhone: string) => {
    const code = createSevenDigitCode();
    const qrDataUrl = await createQrDataUrl(code);

    const { error } = await supabase
      .from('door_verification_codes')
      .insert({
        phone: targetPhone,
        code,
      });

    if (error) throw error;

    setLastCode(code);
    setLastQrDataUrl(qrDataUrl);
    return code;
  };

  const handleSend = async () => {
    const normalizedPhone = phone.replace(/[^0-9]/g, '');

    if (normalizedPhone.length < 9) {
      setMessage('전화번호를 정확히 입력해 주세요.');
      return;
    }

    setIsSending(true);
    setMessage('');

    try {
      await createAndSaveCode(normalizedPhone);
      setPhone('');
      setMessage('비상 인증코드를 생성했습니다.');
      await loadHistory();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '코드 생성 중 오류가 발생했습니다.');
    } finally {
      setIsSending(false);
    }
  };

  const handleResend = async (item: DoorVerificationCode) => {
    setResendingId(item.id);
    setMessage('');

    try {
      const code = await createAndSaveCode(item.phone);
      setMessage(`${item.phone} 번호로 새 코드 ${code}를 재생성했습니다.`);
      await loadHistory();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '재발송 중 오류가 발생했습니다.');
    } finally {
      setResendingId(null);
    }
  };

  const handleVerifiedChange = async (id: string, verified: boolean) => {
    setHistory((prev) => prev.map((item) => (item.id === id ? { ...item, verified } : item)));

    const { error } = await supabase
      .from('door_verification_codes')
      .update({ verified })
      .eq('id', id);

    if (error) {
      setMessage(`확인 여부 저장에 실패했습니다. ${error.message}`);
      setHistory((prev) => prev.map((item) => (item.id === id ? { ...item, verified: !verified } : item)));
      return;
    }

    setMessage('확인 여부를 저장했습니다.');
  };

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#f6f8fb',
        padding: '16px',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        color: '#111827',
      }}
    >
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        <section
          style={{
            background: '#ffffff',
            border: '1px solid #e5e7eb',
            borderRadius: 8,
            padding: 16,
            boxShadow: '0 2px 8px rgba(15, 23, 42, 0.06)',
          }}
        >
          <h1 style={{ margin: '0 0 12px', fontSize: 22, fontWeight: 800 }}>
            출입문 비상 인증코드 발송
          </h1>

          <label style={{ display: 'block', marginBottom: 8, fontSize: 14, fontWeight: 700 }}>
            전화번호
          </label>
          <input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            inputMode="tel"
            placeholder="01012345678"
            style={{
              width: '100%',
              height: 46,
              boxSizing: 'border-box',
              border: '1px solid #cbd5e1',
              borderRadius: 6,
              padding: '0 12px',
              fontSize: 16,
              outline: 'none',
              background: '#ffffff',
            }}
          />

          <button
            type="button"
            onClick={handleSend}
            disabled={isSending}
            style={{
              width: '100%',
              height: 48,
              marginTop: 12,
              border: 0,
              borderRadius: 6,
              background: isSending ? '#94a3b8' : '#2563eb',
              color: '#ffffff',
              fontSize: 16,
              fontWeight: 800,
              cursor: isSending ? 'not-allowed' : 'pointer',
            }}
          >
            {isSending ? '생성 중...' : '코드 생성'}
          </button>

          {message && (
            <div
              style={{
                marginTop: 12,
                padding: 10,
                borderRadius: 6,
                background: '#eff6ff',
                color: '#1d4ed8',
                fontSize: 14,
                lineHeight: 1.45,
                wordBreak: 'break-word',
              }}
            >
              {message}
            </div>
          )}

          {lastCode && (
            <div
              style={{
                marginTop: 16,
                padding: 14,
                borderRadius: 8,
                border: '1px solid #bfdbfe',
                background: '#dbeafe',
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 700, color: '#1e40af' }}>
                방금 생성한 코드
              </div>
              <div style={{ marginTop: 4, fontSize: 34, fontWeight: 900, letterSpacing: 2 }}>
                {lastCode}
              </div>
              <div style={{ marginTop: 6, fontSize: 13, color: '#1e40af', wordBreak: 'break-all' }}>
                {getConfirmUrl(lastCode)}
              </div>
              {lastQrDataUrl && (
                <img
                  src={lastQrDataUrl}
                  alt="고객 작성 페이지 QR"
                  style={{
                    display: 'block',
                    width: 180,
                    height: 180,
                    marginTop: 12,
                    border: '1px solid #d1d5db',
                    background: '#ffffff',
                  }}
                />
              )}
            </div>
          )}
        </section>

        <section
          style={{
            marginTop: 16,
            background: '#ffffff',
            border: '1px solid #e5e7eb',
            borderRadius: 8,
            overflow: 'hidden',
            boxShadow: '0 2px 8px rgba(15, 23, 42, 0.06)',
          }}
        >
          <div
            style={{
              padding: '12px 14px',
              borderBottom: '1px solid #e5e7eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
            }}
          >
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>최근 발송 이력</h2>
            <button
              type="button"
              onClick={loadHistory}
              style={{
                border: '1px solid #cbd5e1',
                borderRadius: 6,
                background: '#ffffff',
                color: '#334155',
                padding: '7px 10px',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              새로고침
            </button>
          </div>

          {isLoading ? (
            <div style={{ padding: 16, color: '#64748b', fontSize: 14 }}>불러오는 중...</div>
          ) : history.length === 0 ? (
            <div style={{ padding: 16, color: '#64748b', fontSize: 14 }}>발송 이력이 없습니다.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 980 }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    <th style={{ padding: 10, textAlign: 'left', fontSize: 13, color: '#475569' }}>전화번호</th>
                    <th style={{ padding: 10, textAlign: 'left', fontSize: 13, color: '#475569' }}>코드</th>
                    <th style={{ padding: 10, textAlign: 'left', fontSize: 13, color: '#475569' }}>발송시각</th>
                    <th style={{ padding: 10, textAlign: 'left', fontSize: 13, color: '#475569' }}>성함</th>
                    <th style={{ padding: 10, textAlign: 'left', fontSize: 13, color: '#475569' }}>아파트명</th>
                    <th style={{ padding: 10, textAlign: 'center', fontSize: 13, color: '#475569' }}>동의</th>
                    <th style={{ padding: 10, textAlign: 'center', fontSize: 13, color: '#475569' }}>서명</th>
                    <th style={{ padding: 10, textAlign: 'center', fontSize: 13, color: '#475569' }}>확인</th>
                    <th style={{ padding: 10, textAlign: 'center', fontSize: 13, color: '#475569' }}>재발송</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((item) => {
                    const isSubmitted = Boolean(item.submitted_at);
                    return (
                      <tr key={item.id} style={{ borderTop: '1px solid #e5e7eb' }}>
                        <td style={{ padding: 10, fontSize: 14, whiteSpace: 'nowrap' }}>{item.phone}</td>
                        <td style={{ padding: 10, fontSize: 16, fontWeight: 800, letterSpacing: 1 }}>{item.code}</td>
                        <td style={{ padding: 10, fontSize: 14, whiteSpace: 'nowrap' }}>{formatDateTime(item.created_at)}</td>
                        <td style={{ padding: 10, fontSize: 14 }}>
                          {isSubmitted ? item.customer_name || '-' : '고객 작성 대기중'}
                        </td>
                        <td style={{ padding: 10, fontSize: 14 }}>
                          {isSubmitted ? item.apartment_name || '-' : '고객 작성 대기중'}
                        </td>
                        <td style={{ padding: 10, textAlign: 'center', fontSize: 14, whiteSpace: 'nowrap' }}>
                          {isSubmitted ? (item.consent_agreed ? '동의' : '미동의') : '고객 작성 대기중'}
                        </td>
                        <td style={{ padding: 10, textAlign: 'center' }}>
                          {item.signature_data_url ? (
                            <img
                              src={item.signature_data_url}
                              alt="고객 서명"
                              style={{
                                width: 92,
                                height: 46,
                                objectFit: 'contain',
                                border: '1px solid #e5e7eb',
                                borderRadius: 4,
                                background: '#ffffff',
                              }}
                            />
                          ) : (
                            <span style={{ color: '#64748b', fontSize: 13 }}>
                              {isSubmitted ? '서명 없음' : '고객 작성 대기중'}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: 10, textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={item.verified}
                            onChange={(event) => handleVerifiedChange(item.id, event.target.checked)}
                            style={{ width: 22, height: 22 }}
                          />
                        </td>
                        <td style={{ padding: 10, textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => handleResend(item)}
                            disabled={resendingId === item.id}
                            style={{
                              minWidth: 70,
                              height: 34,
                              border: '1px solid #2563eb',
                              borderRadius: 6,
                              background: resendingId === item.id ? '#dbeafe' : '#ffffff',
                              color: '#2563eb',
                              fontSize: 13,
                              fontWeight: 800,
                              cursor: resendingId === item.id ? 'wait' : 'pointer',
                            }}
                          >
                            {resendingId === item.id ? '처리중' : '재발송'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
