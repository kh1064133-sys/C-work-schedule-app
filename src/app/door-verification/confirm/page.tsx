'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { SignaturePad, type SignaturePadHandle } from '@/components/shared/SignaturePad';

type DoorVerificationCode = {
  id: string;
  phone: string;
  code: string;
  customer_name: string | null;
  apartment_name: string | null;
  consent_agreed: boolean;
  signature_data_url: string | null;
  submitted_at: string | null;
};

function DoorVerificationConfirmContent() {
  const searchParams = useSearchParams();
  const code = (searchParams.get('code') || '').trim();
  const supabase = useMemo(() => createClient(), []);
  const signaturePadRef = useRef<SignaturePadHandle>(null);

  const [record, setRecord] = useState<DoorVerificationCode | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [apartmentName, setApartmentName] = useState('');
  const [consentAgreed, setConsentAgreed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  const loadRecord = useCallback(async () => {
    if (!code) {
      setMessage('인증코드가 없습니다.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setMessage('');

    const { data, error } = await supabase
      .from('door_verification_codes')
      .select('id, phone, code, customer_name, apartment_name, consent_agreed, signature_data_url, submitted_at')
      .eq('code', code)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      setMessage(`인증코드를 확인하지 못했습니다. ${error.message}`);
      setIsLoading(false);
      return;
    }

    const found = (data?.[0] || null) as DoorVerificationCode | null;
    if (!found) {
      setMessage('일치하는 인증코드를 찾을 수 없습니다.');
      setIsLoading(false);
      return;
    }

    setRecord(found);
    setCustomerName(found.customer_name || '');
    setApartmentName(found.apartment_name || '');
    setConsentAgreed(Boolean(found.consent_agreed));
    setIsSubmitted(Boolean(found.submitted_at));
    setIsLoading(false);
  }, [code, supabase]);

  useEffect(() => {
    loadRecord();
  }, [loadRecord]);

  const handleSubmit = async () => {
    if (!record) return;

    if (!customerName.trim()) {
      setMessage('성함을 입력해 주세요.');
      return;
    }

    if (!apartmentName.trim()) {
      setMessage('아파트명을 입력해 주세요.');
      return;
    }

    if (!consentAgreed) {
      setMessage('개인정보 수집 및 이용 동의가 필요합니다.');
      return;
    }

    if (!signaturePadRef.current?.hasSignature()) {
      setMessage('서명이 필요합니다.');
      return;
    }

    setIsSubmitting(true);
    setMessage('');

    const { error } = await supabase
      .from('door_verification_codes')
      .update({
        customer_name: customerName.trim(),
        apartment_name: apartmentName.trim(),
        consent_agreed: consentAgreed,
        signature_data_url: signaturePadRef.current.getDataUrl(),
        submitted_at: new Date().toISOString(),
      })
      .eq('id', record.id);

    if (error) {
      setMessage(`제출 중 오류가 발생했습니다. ${error.message}`);
      setIsSubmitting(false);
      return;
    }

    setIsSubmitted(true);
    setMessage('제출이 완료되었습니다.');
    setIsSubmitting(false);
  };

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#f6f8fb',
        padding: 16,
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        color: '#111827',
      }}
    >
      <section
        style={{
          width: '100%',
          maxWidth: 480,
          margin: '0 auto',
          background: '#ffffff',
          border: '1px solid #e5e7eb',
          borderRadius: 8,
          padding: 18,
          boxSizing: 'border-box',
          boxShadow: '0 2px 8px rgba(15, 23, 42, 0.06)',
        }}
      >
        <h1 style={{ margin: '0 0 14px', fontSize: 22, fontWeight: 800 }}>
          출입문 인증 확인
        </h1>

        {isLoading ? (
          <div style={{ padding: '24px 0', color: '#64748b', fontSize: 15 }}>불러오는 중...</div>
        ) : !record ? (
          <div style={{ padding: 12, borderRadius: 6, background: '#fef2f2', color: '#dc2626', fontSize: 15, fontWeight: 700 }}>
            {message || '인증코드를 찾을 수 없습니다.'}
          </div>
        ) : (
          <>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 14, fontWeight: 700 }}>
              인증코드
            </label>
            <input
              value={code}
              readOnly
              style={{
                width: '100%',
                height: 46,
                boxSizing: 'border-box',
                border: '1px solid #cbd5e1',
                borderRadius: 6,
                padding: '0 12px',
                fontSize: 18,
                fontWeight: 900,
                letterSpacing: 1.5,
                color: '#111827',
                background: '#f8fafc',
                outline: 'none',
              }}
            />

            <label style={{ display: 'block', marginTop: 14, marginBottom: 6, fontSize: 14, fontWeight: 700 }}>
              성함
            </label>
            <input
              value={customerName}
              onChange={(event) => setCustomerName(event.target.value)}
              placeholder="성함 입력"
              disabled={isSubmitted}
              style={{
                width: '100%',
                height: 46,
                boxSizing: 'border-box',
                border: '1px solid #cbd5e1',
                borderRadius: 6,
                padding: '0 12px',
                fontSize: 16,
                background: isSubmitted ? '#f1f5f9' : '#ffffff',
                outline: 'none',
              }}
            />

            <label style={{ display: 'block', marginTop: 14, marginBottom: 6, fontSize: 14, fontWeight: 700 }}>
              아파트명
            </label>
            <input
              value={apartmentName}
              onChange={(event) => setApartmentName(event.target.value)}
              placeholder="아파트명 입력"
              disabled={isSubmitted}
              style={{
                width: '100%',
                height: 46,
                boxSizing: 'border-box',
                border: '1px solid #cbd5e1',
                borderRadius: 6,
                padding: '0 12px',
                fontSize: 16,
                background: isSubmitted ? '#f1f5f9' : '#ffffff',
                outline: 'none',
              }}
            />

            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginTop: 14,
                padding: 12,
                border: '1px solid #dbeafe',
                borderRadius: 6,
                background: '#eff6ff',
                fontSize: 14,
                fontWeight: 700,
                color: '#1e40af',
              }}
            >
              <input
                type="checkbox"
                checked={consentAgreed}
                onChange={(event) => setConsentAgreed(event.target.checked)}
                disabled={isSubmitted}
                style={{ width: 20, height: 20, flex: '0 0 auto' }}
              />
              <span>개인정보 수집 및 이용에 동의합니다</span>
            </label>

            <div style={{ marginTop: 14 }}>
              <div style={{ marginBottom: 6, fontSize: 14, fontWeight: 700 }}>서명</div>
              <div
                style={{
                  border: '2px dashed #cbd5e1',
                  borderRadius: 8,
                  overflow: 'hidden',
                  background: '#fafafa',
                }}
              >
                <SignaturePad
                  ref={signaturePadRef}
                  initialDataUrl={record.signature_data_url}
                  disabled={isSubmitted}
                  height={150}
                />
              </div>
              {!isSubmitted && (
                <button
                  type="button"
                  onClick={() => signaturePadRef.current?.clear()}
                  style={{
                    marginTop: 8,
                    height: 34,
                    border: '1px solid #cbd5e1',
                    borderRadius: 6,
                    background: '#ffffff',
                    color: '#475569',
                    padding: '0 12px',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  서명 지우기
                </button>
              )}
            </div>

            {message && (
              <div
                style={{
                  marginTop: 14,
                  padding: 10,
                  borderRadius: 6,
                  background: isSubmitted ? '#ecfdf5' : '#eff6ff',
                  color: isSubmitted ? '#047857' : '#1d4ed8',
                  fontSize: 14,
                  lineHeight: 1.45,
                }}
              >
                {message}
              </div>
            )}

            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || isSubmitted}
              style={{
                width: '100%',
                height: 50,
                marginTop: 16,
                border: 0,
                borderRadius: 6,
                background: isSubmitted ? '#94a3b8' : isSubmitting ? '#93c5fd' : '#2563eb',
                color: '#ffffff',
                fontSize: 16,
                fontWeight: 800,
                cursor: isSubmitting || isSubmitted ? 'not-allowed' : 'pointer',
              }}
            >
              {isSubmitted ? '제출 완료' : isSubmitting ? '제출 중...' : '제출'}
            </button>
          </>
        )}
      </section>
    </main>
  );
}

export default function DoorVerificationConfirmPage() {
  return (
    <Suspense fallback={null}>
      <DoorVerificationConfirmContent />
    </Suspense>
  );
}
