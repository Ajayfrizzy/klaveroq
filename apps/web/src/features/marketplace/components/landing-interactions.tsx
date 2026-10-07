"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

export function HeroScene({ children }: { children: ReactNode }) {
  const scene = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = scene.current!;
    const media = matchMedia(
      "(min-width: 761px) and (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)",
    );
    let frame = 0;
    const reset = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      element.style.removeProperty("--scene-x");
      element.style.removeProperty("--scene-y");
    };
    const move = (event: PointerEvent) => {
      if (!media.matches || event.pointerType !== "mouse") return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const rect = element.getBoundingClientRect();
        const x = Math.max(-1, Math.min(1, ((event.clientX - rect.left) / rect.width - 0.5) * 2));
        const y = Math.max(-1, Math.min(1, ((event.clientY - rect.top) / rect.height - 0.5) * 2));
        element.style.setProperty("--scene-x", String(x));
        element.style.setProperty("--scene-y", String(y));
      });
    };
    const sync = () => {
      reset();
      element.removeEventListener("pointermove", move);
      if (media.matches) element.addEventListener("pointermove", move, { passive: true });
    };
    sync();
    media.addEventListener("change", sync);
    element.addEventListener("pointerleave", reset);
    element.addEventListener("pointercancel", reset);
    return () => {
      reset();
      media.removeEventListener("change", sync);
      element.removeEventListener("pointermove", move);
      element.removeEventListener("pointerleave", reset);
      element.removeEventListener("pointercancel", reset);
    };
  }, []);
  return (
    <div
      ref={scene}
      className="hero-scene"
      role="group"
      aria-label="An illustration of work progressing from professional skills to agreed milestones and delivery"
    >
      {children}
    </div>
  );
}

export function ReputationNotes({ children }: { children: ReactNode }) {
  const track = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const media = matchMedia("(max-width: 760px)");
    const sync = () => setMobile(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);
  useEffect(() => {
    if (!mobile) return;
    const element = track.current!;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(Array.from(element.children).indexOf(entry.target));
        }
      },
      { root: element, threshold: 0.65 },
    );
    Array.from(element.children).forEach((slide) => observer.observe(slide));
    return () => observer.disconnect();
  }, [mobile]);
  const go = (index: number) => {
    const element = track.current!;
    const slide = element.children[Math.max(0, Math.min(2, index))] as HTMLElement;
    // Scroll only the track, without moving the page vertically.
    element.scrollTo({
      left: slide.offsetLeft - (element.firstElementChild as HTMLElement).offsetLeft,
    });
  };
  return (
    <div
      className="trust-carousel"
      role="group"
      aria-label="Reputation principles"
      aria-roledescription={mobile ? "carousel" : undefined}
    >
      <div
        ref={track}
        id="reputation-notes"
        className="trust-notes"
        tabIndex={mobile ? 0 : undefined}
        aria-label={
          mobile ? "Reputation principles. Use left and right arrow keys to browse." : undefined
        }
        onKeyDown={(event) => {
          if (!mobile) return;
          const index = { ArrowLeft: active - 1, ArrowRight: active + 1, Home: 0, End: 2 }[
            event.key
          ];
          if (index !== undefined) {
            event.preventDefault();
            go(index);
          }
        }}
      >
        {children}
      </div>
      <div className="trust-controls" aria-label="Choose a reputation principle">
        {[0, 1, 2].map((index) => (
          <button
            key={index}
            type="button"
            aria-label={`Show reputation principle ${index + 1} of 3`}
            aria-controls="reputation-notes"
            aria-current={active === index ? "true" : undefined}
            onClick={() => go(index)}
          >
            <span />
          </button>
        ))}
        <span className="trust-progress" aria-live="polite" aria-atomic="true">
          {active + 1} / 3
        </span>
      </div>
    </div>
  );
}
