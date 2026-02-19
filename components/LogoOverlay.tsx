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
 *   "Final Archive Media" at y≈145, font-size 82  → occupies roughly top 0–55%
 *   "For All Eternity"    at y≈200, font-size 24  → occupies roughly 55–75%
 *
 * Steps (each must fully finish before the next begins):
 *   1. Black screen for 1 second
 *   2. Fade in "Final Archive Media" over 1 second, centered
 *   3. Hold "Final Archive Media" for 3 seconds
 *   4. Fade in "For All Eternity" underneath over 1 second, dimmed/etched
 *   5. Fade out "Final Archive Media" over 2 seconds
 *   6. "For All Eternity" remains permanently visible, faint etched style
 *
 * After Step 6 → onIntroComplete() fires → Gallery starts (Step 7)
 * Hover-to-reveal stays disabled until Step 8 (hoverEnabled prop)
 */

export const LogoOverlay: React.FC<LogoOverlayProps> = ({ onIntroComplete, hoverEnabled }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLImageElement>(null);
  const taglineRef = useRef<HTMLImageElement>(null);
  const tlRef = useRef<gsap.core.Timeline | null>(null);
  const [logoLoaded, setLogoLoaded] = useState(false);
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

    const title = titleRef.current;
    const tagline = taglineRef.current;
    if (!title || !tagline) return;

    // Initial state: both hidden
    gsap.set(title, { autoAlpha: 0 });
    gsap.set(tagline, { autoAlpha: 0 });

    const tl = gsap.timeline({
      onComplete: () => {
        onIntroComplete();
      },
    });
    tlRef.current = tl;

    // Step 1: Black screen for 1 second
    tl.to({}, { duration: 1 });

    // Step 2: Fade in "Final Archive Media" over 1 second
    tl.to(title, {
      autoAlpha: 1,
      duration: 1,
      ease: 'power2.inOut',
    });

    // Step 3: Hold "Final Archive Media" for 3 seconds
    tl.to({}, { duration: 3 });

    // Step 4: Fade in "For All Eternity" underneath over 1 second (dimmed)
    tl.to(tagline, {
      autoAlpha: 0.3,
      duration: 1,
      ease: 'power2.inOut',
    });

    // Step 5: Fade out "Final Archive Media" over 2 seconds
    tl.to(title, {
      autoAlpha: 0,
      duration: 2,
      ease: 'power2.inOut',
    });

    // Step 6: "For All Eternity" stays at 0.3 (faint etched) — no animation needed

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

  /*
   * Clip-path math for SVG viewBox 0 0 800 300:
   *   "Final Archive Media" baseline y=145, font-size=82 → glyph top ≈ y=75, bottom ≈ y=150
   *   "For All Eternity"    baseline y=200, font-size=24 → glyph top ≈ y=180, bottom ≈ y=205
   *
   *   Dividing line ≈ y=165 → 165/300 = 55%
   *
   *   Title  clip: inset(0%  0% 45% 0%)  → show top 55%
   *   Tagline clip: inset(55% 0%  0% 0%)  → show bottom 45%
   */

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
        backgroundColor: 'transparent',
        pointerEvents: hoverEnabled ? 'auto' : 'none',
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '85vw',
          maxWidth: '700px',
          /* SVG is 800×300 → aspect 8:3 ≈ 2.67:1 */
          aspectRatio: '800 / 300',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* "Final Archive Media" — top 55% of SVG */}
        <img
          ref={titleRef}
          src={logoSrc}
          alt="Final Archive Media"
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
