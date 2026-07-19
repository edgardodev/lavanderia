"use client";

import React, { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

export default function NavigationProgress() {
  const pathname = usePathname();
  const prevPath = useRef<string | null>(null);
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (prevPath.current === null) {
      prevPath.current = pathname;
      return;
    }
    if (pathname === prevPath.current) return;
    prevPath.current = pathname;

    // start animation
    setVisible(true);
    setProgress(8);
    let current = 8;
    intervalRef.current = window.setInterval(() => {
      current = Math.min(90, current + Math.floor(Math.random() * 10) + 5);
      setProgress(current);
    }, 200) as unknown as number;

    // finalize after a short delay to give feeling of work
    const finish = window.setTimeout(() => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setProgress(100);
      window.setTimeout(() => {
        setVisible(false);
        setProgress(0);
      }, 260);
    }, 600);

    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      window.clearTimeout(finish);
    };
  }, [pathname]);

  if (!visible) return null;

  return (
    <>
      <div className="fixed top-0 left-0 right-0 z-[9999] pointer-events-none">
        <div className="h-1 bg-transparent">
          <div
            style={{ width: `${progress}%`, transition: "width 180ms linear" }}
            className="h-1 bg-yellowBrand shadow-lg"
          />
        </div>
      </div>

      <div className="fixed inset-0 z-[9998] flex items-center justify-center pointer-events-none">
        <div className="rounded-full bg-white/90 p-3 shadow-lg backdrop-blur-sm">
          <svg
            className="h-6 w-6 animate-spin text-aqua"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
        </div>
      </div>
    </>
  );
}
