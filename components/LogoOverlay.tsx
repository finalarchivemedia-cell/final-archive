import React, { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { LOGO_PATH } from '../constants';

interface LogoOverlayProps {
  onIntroComplete: () => void;
  hoverEnabled: boolean;
}

/**
 * LogoOverlay – Client's mandatory 6-step intro sequence
 *
 * SVG layout (800×300):
 *   "Final Archive" at y≈145, font-size 82  → top ~55%
 *   "For All Eternity" at y≈200, font-size 24  → bottom ~45%
 *
 * Steps (each must fully finish before the next begins):
 *   1. Black screen for 1 second
 *   2. Fade in "Final Archive" over 1 second, centered
 *   3. Hold "Final Archive" for 3 seconds
 *   4. Fade in "For All Eternity" underneath over 1 second, dimmed/etched
 *   5. Fade out "Final Archive" over 2 seconds
 *   6. "For All Eternity" remains permanently visible, faint etched style
 *
 * CRITICAL: Steps 1-6 are BLACK-SCREEN phase with TEXT ONLY.
 *   - Background is solid black during intro
 *   - After Step 6 → onIntroComplete() fires → background fades to transparent
 *   - Gallery starts rendering (Step 7)
 *   - Hover-to-reveal stays disabled until Step 8 (hoverEnabled prop)
 */

export const LogoOverlay: React.FC<LogoOverlayProps> = ({ onIntroComplete, hoverEnabled }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLImageElement>(null);
  const taglineRef = useRef<HTMLImageElement>(null);
  const tlRef = useRef<gsap.core.Timeline | null>(null);
  const [logoLoaded, setLogoLoaded] = useState(false);
  const [introFinished, setIntroFinished] = useState(false);
  const logoSrc = LOGO_PATH;

  // Preload the SVG
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      if ('decode' in img) {
        img.decode().then(() => setLogoLoaded(true)).catch(() => setLogoLoaded(true));
      } else {
        setLogoLoaded(true);
      }
    };
    img.onerror = () => {
      console.warn('[LogoOverlay] Failed to load logo');
      setLogoLoaded(true);
    };
    img.src = logoSrc;
  }, [logoSrc]);

  // Run the 6-step intro timeline
  useEffect(() => {
    if (!logoLoaded) return;

    const container = containerRef.current;
    const title = titleRef.current;
    const tagline = taglineRef.current;
    if (!container || !title || !tagline) return;

    // Initial state: both text elements hidden, container is solid black
    gsap.set(title, { autoAlpha: 0 });
    gsap.set(tagline, { autoAlpha: 0 });

    const tl = gsap.timeline({
      onComplete: () => {
        // After Step 6: fade the black background to transparent so Gallery shows
        gsap.to(container, {
          backgroundColor: 'transparent',
          duration: 1.0,
          ease: 'power2.inOut',
          onComplete: () => {
            setIntroFinished(true);
            onIntroComplete();
          },
        });
      },
    });
    tlRef.current = tl;

    // Step 1: Black screen for 1 second
    tl.to({}, { duration: 1 });

    // Step 2: Fade in "Final Archive" over 1 second
    tl.to(title, {
      autoAlpha: 1,
      duration: 1,
      ease: 'power2.inOut',
    });

    // Step 3: Hold "Final Archive" for 3 seconds
    tl.to({}, { duration: 3 });

    // Step 4: Fade in "For All Eternity" underneath over 1 second (dimmed/etched)
    tl.to(tagline, {
      autoAlpha: 0.3,
      duration: 1,
      ease: 'power2.inOut',
    });

    // Step 5: Fade out "Final Archive" over 2 seconds
    tl.to(title, {
      autoAlpha: 0,
      duration: 2,
      ease: 'power2.inOut',
    });

    // Step 6: "For All Eternity" stays at 0.3 (faint etched) — no animation needed
    // Timeline completes → onComplete fires → background fades to transparent

    return () => {
      tl.kill();
    };
  }, [logoLoaded, onIntroComplete]);

  // Hover: reveal tagline fully (gated by hoverEnabled = Step 8)
  const handleMouseEnter = () => {
    if (!hoverEnabled) return;
    gsap.to(taglineRef.current, { autoAlpha: 1, duration: 0.5, ease: 'power2.out' });
  };

  const handleMouseLeave = () => {
    gsap.to(taglineRef.current, { autoAlpha: 0.3, duration: 0.5, ease: 'power2.in' });
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        margin: 0,
        padding: 0,
        // CRITICAL: Solid black during Steps 1-6 (text-only phase)
        // After intro, GSAP fades this to transparent so Gallery shows through
        backgroundColor: introFinished ? 'transparent' : '#000',
        pointerEvents: hoverEnabled ? 'auto' : 'none',
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '85vw',
          maxWidth: '700px',
          aspectRatio: '800 / 300',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* "Final Archive" — top 55% of SVG */}
        <img
          ref={titleRef}
          src={logoSrc}
          alt="Final Archive"
          draggable={false}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            objectPosition: 'center center',
            clipPath: 'inset(0% 0% 45% 0%)',
            WebkitClipPath: 'inset(0% 0% 45% 0%)',
            opacity: 0,
            visibility: 'hidden',
            border: 'none',
            outline: 'none',
            pointerEvents: 'none',
            willChange: 'opacity',
          }}
          aria-hidden="true"
        />

        {/* "For All Eternity" — bottom 45% of SVG */}
        <img
          ref={taglineRef}
          src={logoSrc}
          alt="For All Eternity"
          draggable={false}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            objectPosition: 'center center',
            clipPath: 'inset(55% 0% 0% 0%)',
            WebkitClipPath: 'inset(55% 0% 0% 0%)',
            opacity: 0,
            visibility: 'hidden',
            border: 'none',
            outline: 'none',
            pointerEvents: 'none',
            willChange: 'opacity',
          }}
          aria-hidden="true"
        />
      </div>
    </div>
  );
};
