'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import {
  CreditCard,
  DoorOpen,
  Hash,
  Pause,
  Phone,
  Play,
  RotateCcw,
} from 'lucide-react';
import styles from './DoorManualAnimation.module.css';

type Hotspot = {
  label: string;
  x: number;
  y: number;
  delay: number;
};

type ManualStep = {
  title: string;
  summary: string;
  icon: 'hash' | 'phone' | 'card' | 'door';
  hotspots: Hotspot[];
};

const steps: ManualStep[] = [
  {
    title: '비밀번호로 출입',
    summary: '등록된 번호를 차례로 누른 뒤 ST를 누르면 인증이 진행됩니다.',
    icon: 'hash',
    hotspots: [
      { label: '1', x: 18, y: 44, delay: 0 },
      { label: '2', x: 32, y: 44, delay: 0.75 },
      { label: '3', x: 46, y: 44, delay: 1.5 },
      { label: 'ST', x: 48, y: 64, delay: 2.25 },
    ],
  },
  {
    title: '세대 호출',
    summary: '호수를 입력하고 통화 버튼을 누르면 도어폰 호출이 시작됩니다.',
    icon: 'phone',
    hotspots: [
      { label: '1', x: 18, y: 44, delay: 0 },
      { label: '0', x: 32, y: 64, delay: 0.75 },
      { label: '1', x: 18, y: 44, delay: 1.5 },
      { label: '통화', x: 21, y: 74, delay: 2.25 },
    ],
  },
  {
    title: '카드키 인증',
    summary: '카드를 CARD 표시부에 가까이 대면 인증음 후 문이 열립니다.',
    icon: 'card',
    hotspots: [
      { label: 'CARD', x: 76, y: 58, delay: 0 },
      { label: '인증', x: 76, y: 58, delay: 1.2 },
      { label: '열림', x: 51, y: 90, delay: 2.25 },
    ],
  },
  {
    title: '문열림 버튼',
    summary: '관리자 또는 실내기 허가 후 문열림 버튼으로 출입문을 개방합니다.',
    icon: 'door',
    hotspots: [
      { label: '확인', x: 40, y: 74, delay: 0 },
      { label: '문열림', x: 21, y: 74, delay: 1.15 },
      { label: '개방', x: 51, y: 90, delay: 2.2 },
    ],
  },
];

const iconMap = {
  hash: Hash,
  phone: Phone,
  card: CreditCard,
  door: DoorOpen,
};

export function DoorManualAnimation() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [replayKey, setReplayKey] = useState(0);

  const activeStep = steps[activeIndex];
  const ActiveIcon = iconMap[activeStep.icon];

  useEffect(() => {
    if (!isPlaying) return;

    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % steps.length);
      setReplayKey((current) => current + 1);
    }, 5200);

    return () => window.clearInterval(timer);
  }, [isPlaying]);

  const progressSegments = useMemo(
    () => steps.map((step, index) => ({ title: step.title, isActive: index === activeIndex })),
    [activeIndex],
  );

  const selectStep = (index: number) => {
    setActiveIndex(index);
    setReplayKey((current) => current + 1);
  };

  const replay = () => {
    setReplayKey((current) => current + 1);
  };

  return (
    <section className={styles.shell} aria-label="도어폰 간편 매뉴얼 애니메이션">
      <div className={styles.stage}>
        <div className={styles.deviceWrap}>
          <Image
            className={styles.device}
            src="/door-access-panel.png"
            alt="IDS 도어폰 전면 패널"
            width={286}
            height={400}
            priority
          />

          <div key={`${activeIndex}-${replayKey}`} className={styles.hotspotLayer}>
            {activeStep.hotspots.map((hotspot, index) => (
              <span
                key={`${hotspot.label}-${index}`}
                className={styles.hotspot}
                style={{
                  left: `${hotspot.x}%`,
                  top: `${hotspot.y}%`,
                  animationDelay: `${hotspot.delay}s`,
                }}
                aria-hidden="true"
              >
                <span className={styles.finger} />
                <span className={styles.hotspotLabel}>{hotspot.label}</span>
              </span>
            ))}
          </div>
        </div>

        <div className={styles.caption} key={`${activeStep.title}-${replayKey}`}>
          <div className={styles.captionIcon}>
            <ActiveIcon size={22} aria-hidden="true" />
          </div>
          <div>
            <p className={styles.eyebrow}>간편 매뉴얼</p>
            <h1>{activeStep.title}</h1>
            <p>{activeStep.summary}</p>
          </div>
        </div>
      </div>

      <div className={styles.controls}>
        <div className={styles.stepTabs} role="tablist" aria-label="매뉴얼 단계 선택">
          {progressSegments.map((segment, index) => (
            <button
              key={segment.title}
              className={segment.isActive ? styles.activeTab : styles.tab}
              type="button"
              role="tab"
              aria-selected={segment.isActive}
              onClick={() => selectStep(index)}
            >
              {segment.title}
            </button>
          ))}
        </div>

        <div className={styles.toolButtons}>
          <button
            type="button"
            className={styles.iconButton}
            onClick={() => setIsPlaying((value) => !value)}
            aria-label={isPlaying ? '애니메이션 일시정지' : '애니메이션 재생'}
            title={isPlaying ? '일시정지' : '재생'}
          >
            {isPlaying ? <Pause size={20} /> : <Play size={20} />}
          </button>
          <button
            type="button"
            className={styles.iconButton}
            onClick={replay}
            aria-label="현재 단계 다시 보기"
            title="다시 보기"
          >
            <RotateCcw size={20} />
          </button>
        </div>
      </div>
    </section>
  );
}
