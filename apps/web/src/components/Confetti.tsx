/**
 * Confetti (F6): earned at exactly two moments — payment success and
 * campaign goal completion. Single component, transform/opacity only (F2),
 * disabled under prefers-reduced-motion (F9), flat squares (no images).
 */
import React, { useEffect, useState } from "react";

interface Piece {
  left: number;
  delay: number;
  duration: number;
  size: number;
  color: string;
  drift: number;
}

export function Confetti({ show, onDone }: { show: boolean; onDone?: () => void }): React.ReactElement | null {
  const [pieces] = useState<Piece[]>(() =>
    Array.from({ length: 40 }, (_, i) => ({
      left: (i * 97) % 100,
      delay: (i % 10) * 80,
      duration: 1800 + ((i * 131) % 900),
      size: 6 + ((i * 7) % 6),
      color: i % 3 === 0 ? "var(--c-accent)" : i % 3 === 1 ? "var(--c-neutral-300)" : "var(--c-neutral-500)",
      drift: ((i * 53) % 40) - 20,
    })),
  );
  const [visible, setVisible] = useState(show);

  useEffect(() => {
    if (!show) return;
    setVisible(true);
    const t = setTimeout(() => {
      setVisible(false);
      onDone?.();
    }, 3000);
    return () => clearTimeout(t);
  }, [show, onDone]);

  if (!visible) return null;
  return (
    <div aria-hidden="true" style={{ position: "fixed", inset: 0, pointerEvents: "none", overflow: "hidden", zIndex: 70 }}>
      {pieces.map((p, i) => (
        <span
          key={i}
          style={{
            position: "absolute",
            top: -20,
            left: `${p.left}%`,
            width: p.size,
            height: p.size,
            background: p.color,
            animation: `fedites-confetti-fall ${p.duration}ms ease-in ${p.delay}ms forwards`,
            ["--drift" as string]: `${p.drift}px`,
          }}
        />
      ))}
      <style>{`
        @keyframes fedites-confetti-fall {
          0% { transform: translate(0, 0) rotate(0deg); opacity: 1; }
          100% { transform: translate(var(--drift), 110vh) rotate(540deg); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="fedites-confetti-fall"] { animation: none !important; opacity: 0 !important; }
        }
      `}</style>
    </div>
  );
}
