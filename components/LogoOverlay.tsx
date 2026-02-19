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
 * Steps (each must fully finish before the next begins):
 *   1. Black screen for 1 second
 *   2. Fade in "Final Archive Media" over 1 second, centered
 *   3. Hold "Final Archive Media" for 3 seconds
 *   4. Fade in "For All Eternity" underneath over 1 second, dimmed/etched
 *   5. Fade out "Final Archive Media" over 2 seconds
 *   6. "For All Eternity" remains permanently visible, faint etched style
 *
 * CRITICAL: Steps 1-6 are BLACK-SCREEN phase with TEXT ONLY.
 *   After Step 6 → black fades to transparent → onIntroComplete() → Gallery starts
 */

export const LogoOverlay: React.FC<LogoOverlayProps> = ({ onIntroComplete, hoverEnabled }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLImageElement>(null);
  const taglineRef = useRef<HTMLImageElement>(null);
  const [logoLoaded, setLogoLoaded] = useState(false);
  const [introFinished, setIntroFinished] = useState(false);

  // Store callback in ref so it never triggers useEffect re-runs
  const onIntroCompleteRef = useRef(onIntroComplete);
  onIntroCompleteRef.current = onIntroComplete;

  // Guard: only run the intro timeline ONCE
  const hasRun = useRef(false);

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

  // Run the 6-step intro timeline — ONCE only
  useEffect(() => {
    if (!logoLoaded || hasRun.current) return;
    hasRun.current = true;

    const container = containerRef.current;
    const title = titleRef.current;
    const tagline = taglineRef.current;
    if (!container || !title || !tagline) return;

    // Initial state: both text elements hidden
    gsap.set(title, { autoAlpha: 0 });
    gsap.set(tagline, { autoAlpha: 0 });

    const tl = gsap.timeline({
      onComplete: () => {
        // After Step 6: fade the black background to transparent so Gallery shows
        gsap.to(container, {
          backgroundColor: 'rgba(0,0,0,0)',
          duration: 1.0,
          ease: 'power2.inOut',
          onComplete: () => {
            setIntroFinished(true);
            onIntroCompleteRef.current();
          },
        });
      },
    });

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

    // Step 4: Fade in "For All Eternity" underneath over 1 second (dimmed/etched)
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

    // Step 6: "For All Eternity" stays at 0.3 (faint etched)
    // Timeline completes → onComplete fires → background fades → Gallery starts

    // No cleanup — timeline runs once and must not be killed
  }, [logoLoaded]);

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
        // Solid black during Steps 1-6, then GSAP fades to transparent
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
