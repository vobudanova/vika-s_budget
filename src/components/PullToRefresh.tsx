'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader } from '@mantine/core';
import { IconArrowDown } from '@tabler/icons-react';

const THRESHOLD = 70; // px натяжения для срабатывания
const MAX_PULL = 110;

/**
 * Pull-to-refresh для standalone-режима (с экрана «Домой» нативного жеста нет).
 * Индикатор появляется при протяжке вниз от верха страницы; отпускание за
 * порогом перезапрашивает данные через router.refresh().
 * Для проверки в обычном браузере: ?ptr=1.
 */
export function PullToRefresh() {
  const router = useRouter();
  const [enabled, setEnabled] = useState(false);
  const [pull, setPullState] = useState(0);
  const [refreshing, startTransition] = useTransition();
  const state = useRef({ startY: 0, pulling: false, pull: 0 });
  const setPull = (v: number) => {
    state.current.pull = v;
    setPullState(v);
  };

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as { standalone?: boolean }).standalone === true;
    const debug = new URLSearchParams(window.location.search).has('ptr');
    setEnabled(standalone || debug);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const onTouchStart = (e: TouchEvent) => {
      if (window.scrollY > 0 || e.touches.length !== 1) return;
      state.current.startY = e.touches[0].clientY;
      state.current.pulling = true;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!state.current.pulling) return;
      const dy = e.touches[0].clientY - state.current.startY;
      if (dy <= 0 || window.scrollY > 0) {
        setPull(0);
        return;
      }
      // сопротивление растёт с расстоянием
      const distance = Math.min(MAX_PULL, dy * 0.45);
      if (distance > 8 && e.cancelable) e.preventDefault();
      setPull(distance);
    };

    const onTouchEnd = () => {
      if (!state.current.pulling) return;
      state.current.pulling = false;
      if (state.current.pull >= THRESHOLD) {
        startTransition(() => router.refresh());
      }
      setPull(0);
    };

    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    window.addEventListener('touchcancel', onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [enabled, router, startTransition]);

  if (!enabled) return null;
  const visible = pull > 8 || refreshing;
  const progress = Math.min(1, pull / THRESHOLD);

  return (
    <div
      aria-hidden={!refreshing}
      role="status"
      aria-label={refreshing ? 'Обновление данных' : undefined}
      style={{
        position: 'fixed',
        top: `calc(env(safe-area-inset-top, 0px) + 62px)`,
        left: '50%',
        zIndex: 400,
        width: 38,
        height: 38,
        borderRadius: '50%',
        background: 'var(--mantine-color-white)',
        border: '1px solid var(--ink-line)',
        boxShadow: '0 2px 8px rgba(28, 38, 32, 0.12)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--mantine-color-ink-7)',
        transform: `translateX(-50%) translateY(${visible ? Math.max(pull * 0.35, refreshing ? 12 : 0) : -56}px) scale(${visible ? 1 : 0.6})`,
        opacity: visible ? Math.max(progress, refreshing ? 1 : 0) : 0,
        transition: state.current.pulling ? 'none' : 'transform 200ms ease, opacity 200ms ease',
        pointerEvents: 'none',
      }}
    >
      {refreshing ? (
        <Loader size={20} color="ink" />
      ) : (
        <IconArrowDown
          size={20}
          stroke={2}
          style={{
            transform: `rotate(${progress >= 1 ? 180 : 0}deg)`,
            transition: 'transform 150ms ease',
          }}
        />
      )}
    </div>
  );
}
