'use client';

/* eslint-disable @next/next/no-img-element */
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import QRCode from 'qrcode';

function DoorVerificationQrContent() {
  const searchParams = useSearchParams();
  const code = searchParams.get('code') || '';
  const [qrDataUrl, setQrDataUrl] = useState('');

  useEffect(() => {
    if (!code) return;

    QRCode.toDataURL(code, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 320,
    }).then(setQrDataUrl);
  }, [code]);

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f6f8fb',
        padding: 16,
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <section
        style={{
          width: '100%',
          maxWidth: 420,
          background: '#ffffff',
          border: '1px solid #e5e7eb',
          borderRadius: 8,
          padding: 20,
          textAlign: 'center',
          boxShadow: '0 2px 8px rgba(15, 23, 42, 0.06)',
        }}
      >
        <h1 style={{ margin: '0 0 12px', fontSize: 22, fontWeight: 800, color: '#111827' }}>
          출입문 비상인증 QR
        </h1>
        {code ? (
          <>
            <div style={{ marginBottom: 12, fontSize: 32, fontWeight: 900, letterSpacing: 2, color: '#111827' }}>
              {code}
            </div>
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="출입문 비상인증 QR"
                style={{
                  width: 260,
                  height: 260,
                  maxWidth: '100%',
                  border: '1px solid #d1d5db',
                  background: '#ffffff',
                }}
              />
            ) : (
              <div style={{ color: '#64748b', fontSize: 14 }}>QR 생성 중...</div>
            )}
          </>
        ) : (
          <div style={{ color: '#dc2626', fontSize: 15, fontWeight: 700 }}>
            인증코드가 없습니다.
          </div>
        )}
      </section>
    </main>
  );
}

export default function DoorVerificationQrPage() {
  return (
    <Suspense fallback={null}>
      <DoorVerificationQrContent />
    </Suspense>
  );
}
