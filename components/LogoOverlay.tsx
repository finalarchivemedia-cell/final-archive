import React, { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { LOGO_PATH } from '../constants';

interface LogoOverlayProps {
  onIntroComplete: () => void;
  hoverEnabled: boolean;
}

/**
 * LogoOverlay – Client's mandatory 6-step intro sequence + full tagline reveal
 *
 * PNG layout (2303×842):
 *   "Final Archive"    occupies roughly top 0–60%
 *   gap                ~60–74%
 *   "For All Eternity" occupies roughly 74–87%
 *   Dividing line at ~67% → title clip shows top 67%, tagline clip shows bottom 33%
 *
 * Steps (each must fully finish before the next begins):
 *   1. Black screen for 1 second
 *   2. Fade in "Final Archive" over 1 second, centered
 *   3. Hold "Final Archive" for 3 seconds
 *   4. Fade in "For All Eternity" underneath over 1 second, dimmed/etched
 *   5. Fade out "Final Archive" over 2 seconds
 *   6. "For All Eternity" remains permanently visible, faint etched style
 *
 * After Step 8 (first photo cycle complete):
 *   Hovering over the etched "For All Eternity" reveals the full tagline:
 *   "Final Archive Media captures our story as if it's the last record left
 *    behind—to stand through time, For All Eternity."
 *   in an elegant Cormorant Garamond italic font.
 */

// Extended tagline — displayed ABOVE the PNG "For All Eternity" so the
// already-visible etched text naturally completes the sentence.
// Desktop + landscape: single line. Portrait mobile: two lines.
const TAGLINE_LINE_1 = 'Capturing our story as if it\u2019s the last record left behind';
const TAGLINE_LINE_2 = '\u2014to stand through time,';
const TAGLINE_SINGLE = TAGLINE_LINE_1 + TAGLINE_LINE_2;

export const LogoOverlay: React.FC<LogoOverlayProps> = ({ onIntroComplete, hoverEnabled }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLImageElement>(null);
  const taglineRef = useRef<HTMLImageElement>(null);
  const fullTaglineRef = useRef<HTMLDivElement>(null);
  const [logoLoaded, setLogoLoaded] = useState(false);
  const [introFinished, setIntroFinished] = useState(false);

  // Mobile tap toggle
  const [tapped, setTapped] = useState(false);

  // Store callback in ref so it never triggers useEffect re-runs
  const onIntroCompleteRef = useRef(onIntroComplete);
  onIntroCompleteRef.current = onIntroComplete;

  // Guard: only run the intro timeline ONCE
  const hasRun = useRef(false);

  const logoSrc = LOGO_PATH;

  // Preload the logo PNG
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
    const fullTagline = fullTaglineRef.current;
    if (!container || !title || !tagline) return;

    // Initial state: both text elements hidden, full tagline hidden
    gsap.set(title, { autoAlpha: 0 });
    // Ensure tagline is completely hidden - use display none to prevent any rendering
    gsap.set(tagline, { 
      autoAlpha: 0,
      opacity: 0,
      visibility: 'hidden',
      display: 'none'
    });
    if (fullTagline) gsap.set(fullTagline, { autoAlpha: 0 });

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
      display: 'block',
      maxHeight: '100%',
      height: '100%',
      autoAlpha: 0.3,
      opacity: 0.3,
      visibility: 'visible',
      duration: 1,
      ease: 'power2.inOut',
    });

    // Step 5: Fade out "Final Archive" over 2 seconds
    tl.to(title, {
      autoAlpha: 0,
      duration: 2,
      ease: 'power2.inOut',
    });

    // Step 6: "For All Eternity" stays at 0.3 (faint etched)
    // Timeline completes → onComplete fires → background fades → Gallery starts

    // No cleanup — timeline runs once and must not be killed
  }, [logoLoaded]);

  // ── Hover / Tap: reveal full tagline ──────────────────────────
  const showFullTagline = () => {
    if (!hoverEnabled) return;
    if (taglineRef.current) {
      gsap.to(taglineRef.current, { autoAlpha: 1, duration: 0.5, ease: 'power2.out' });
    }
    if (fullTaglineRef.current) {
      gsap.to(fullTaglineRef.current, {
        autoAlpha: 1,
        y: 0,
        duration: 0.7,
        ease: 'power2.out',
      });
    }
  };

  const hideFullTagline = () => {
    if (taglineRef.current) {
      gsap.to(taglineRef.current, { autoAlpha: 0.3, duration: 0.5, ease: 'power2.in' });
    }
    if (fullTaglineRef.current) {
      gsap.to(fullTaglineRef.current, {
        autoAlpha: 0,
        y: -6,
        duration: 0.5,
        ease: 'power2.in',
      });
    }
  };

  const handleMouseEnter = () => showFullTagline();
  const handleMouseLeave = () => hideFullTagline();

  // Mobile: tap to toggle
  const handleTap = () => {
    if (!hoverEnabled) return;
    if (tapped) {
      hideFullTagline();
      setTapped(false);
    } else {
      showFullTagline();
      setTapped(true);
    }
  };

  // Close on tap outside (mobile)
  useEffect(() => {
    if (!tapped) return;
    const handleOutside = (e: PointerEvent) => {
      const inner = containerRef.current?.querySelector('[data-tagline-area]');
      if (inner && !inner.contains(e.target as Node)) {
        hideFullTagline();
        setTapped(false);
      }
    };
    window.addEventListener('pointerdown', handleOutside);
    return () => window.removeEventListener('pointerdown', handleOutside);
  }, [tapped]);

  // Responsive CSS for tagline layout
  const taglineCSS = `
    /* Default (desktop / landscape): single line */
    .tagline-desktop { display: inline !important; }
    .tagline-mobile  { display: none !important; }

    /* Portrait mobile: two-line layout matching the mockup */
    @media (max-width: 768px) and (orientation: portrait) {
      .tagline-desktop { display: none !important; }
      .tagline-mobile  { display: inline !important; }
    }
  `;

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
        // During intro: block everything. After intro: allow clicks through
        pointerEvents: introFinished ? 'none' : 'auto',
      }}
    >
      {/* Responsive tagline CSS */}
      <style dangerouslySetInnerHTML={{ __html: taglineCSS }} />

      {/* Inner wrapper: logo + tagline hover area */}
      <div
        data-tagline-area
        style={{
          position: 'relative',
          width: '92vw',
          maxWidth: '700px',
          aspectRatio: '2303 / 842',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          // Allow hover/tap on the tagline area after Step 8
          pointerEvents: hoverEnabled ? 'auto' : 'none',
          cursor: hoverEnabled ? 'default' : 'auto',
          // Ensure no overflow from clipped images
          overflow: 'hidden',
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleTap}
      >
        {/* "Final Archive" — top 67% of PNG */}
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
            clipPath: 'inset(0% 0% 33% 0%)',
            WebkitClipPath: 'inset(0% 0% 33% 0%)',
            opacity: 0,
            visibility: 'hidden',
            border: 'none',
            outline: 'none',
            pointerEvents: 'none',
            willChange: 'opacity',
          }}
          aria-hidden="true"
        />

        {/* "For All Eternity" — bottom 33% of PNG */}
        <img
          ref={taglineRef}
          src={logoSrc}
          alt="For All Eternity"
          draggable={false}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            objectFit: 'contain',
            objectPosition: 'center center',
            // More aggressive clip-path (72% - ensures no top edges of letters show)
            clipPath: 'inset(72% 0% 0% 0%)',
            WebkitClipPath: 'inset(72% 0% 0% 0%)',
            // Ensure completely hidden until Step 4 - multiple methods to prevent any rendering
            display: 'none',
            opacity: 0,
            visibility: 'hidden',
            maxHeight: 0,
            height: 0,
            border: 'none',
            outline: 'none',
            pointerEvents: 'none',
            willChange: 'opacity',
            // Additional safety: ensure no overflow
            overflow: 'hidden',
          }}
          aria-hidden="true"
        />

      </div>

      {/* Extended tagline — positioned ABOVE "For All Eternity".
          Placed in the outer fixed container so left:0/right:0 = full viewport width.
          Perfectly centered on screen. */}
      <div
        ref={fullTaglineRef}
        className="tagline-wrap"
        style={{
          position: 'absolute',
          /* Vertically: just above center where "For All Eternity" sits */
          top: '46%',
          left: 0,
          right: 0,
          textAlign: 'center',
          /* Elegant serif — same font */
          fontFamily: "'Cormorant Garamond', 'Georgia', 'Times New Roman', serif",
          fontStyle: 'normal',
          fontWeight: 700,
          fontSize: 'clamp(13px, 2vw, 22px)',
          lineHeight: 1.5,
          letterSpacing: '0.06em',
          color: '#ffffff',
          /* Start hidden */
          opacity: 0,
          visibility: 'hidden',
          willChange: 'opacity, transform',
          pointerEvents: 'none',
          /* Strong dark shadow so white text is readable on ANY background photo */
          textShadow: '0 1px 4px rgba(0,0,0,0.9), 0 0 12px rgba(0,0,0,0.7)',
          padding: '0 16px',
        }}
      >
        {/* Desktop / landscape: single line */}
        <span className="tagline-desktop" style={{ whiteSpace: 'nowrap' }}>
          {TAGLINE_SINGLE}
        </span>
        {/* Portrait mobile: two lines matching the mockup */}
        <span className="tagline-mobile" style={{ whiteSpace: 'normal', textAlign: 'center' }}>
          {TAGLINE_LINE_1}<br />{TAGLINE_LINE_2}
        </span>
      </div>
    </div>
  );
};
