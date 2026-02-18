import React, { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { LOGO_PATH } from '../constants';

interface LogoOverlayProps {
  onIntroComplete: () => void;
  hoverEnabled: boolean;
}

export const LogoOverlay: React.FC<LogoOverlayProps> = ({ onIntroComplete, hoverEnabled }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLImageElement>(null); // "Final Archive" (top part)
  const taglineRef = useRef<HTMLImageElement>(null); // "For All Eternity" (bottom part)
  const tlRef = useRef<gsap.core.Timeline | null>(null);
  const [logoLoaded, setLogoLoaded] = useState(false);
  const logoSrc = `${LOGO_PATH}?v=${Date.now()}`; // Cache-bust for logo updates

  // Load logo image
  useEffect(() => {
    const img = new Image();
    img.onload = () => setLogoLoaded(true);
    img.onerror = () => {
      console.warn('[LogoOverlay] Failed to load logo, using fallback');
      setLogoLoaded(true); // Still proceed with animation
    };
    img.src = logoSrc;
  }, [logoSrc]);

  useEffect(() => {
    if (!logoLoaded) return; // Wait for logo to load
    
    // Master Timeline - Client Requirements: Strict 6-Step Sequence
    const tl = gsap.timeline({
      onComplete: () => {
        onIntroComplete();
      },
    });
    tlRef.current = tl;

    // Initial State: Both parts hidden
    gsap.set([titleRef.current, taglineRef.current], { 
      autoAlpha: 0,
      opacity: 0,
      visibility: 'hidden',
      display: 'none'
    });
    
    // Step 1: Black screen hold 1s
    // (No animation, just delay)
    
    // Step 2: "Final Archive" (top part) fades in over 1s, centered, holds 3s
    tl.set(titleRef.current, { 
      display: 'block',
      visibility: 'visible'
    });
    tl.to(titleRef.current, { 
      autoAlpha: 1, 
      opacity: 1,
      duration: 1, 
      ease: "sine.inOut" 
    }, "+=1.0"); // The +=1.0 is the Step 1 delay

    // Step 3: Hold "Final Archive" for 3s
    tl.to({}, { duration: 3 });

    // Step 4: While "Final Archive" is up, "For All Eternity" (bottom part) fades in underneath - dimmed
    tl.set(taglineRef.current, { 
      display: 'block',
      visibility: 'visible',
      opacity: 0.3, // Dimmed from start
      autoAlpha: 0.3
    });
    tl.to(taglineRef.current, { 
      autoAlpha: 0.3, // Keep dimmed
      opacity: 0.3,
      duration: 1, 
      ease: "sine.inOut" 
    });

    // Step 5: "Final Archive" fades out over 2s
    tl.to(titleRef.current, { 
      autoAlpha: 0, 
      opacity: 0,
      duration: 2, 
      ease: "sine.inOut" 
    });

    // Step 6: "For All Eternity" stays permanent but faint (etched) - already set in Step 4
    // No additional animation needed

    return () => {
      tl.kill();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logoLoaded]); // Run when logo is loaded

  // Hover Interaction (Gated by hoverEnabled - Step 8)
  const handleMouseEnter = () => {
    if (!hoverEnabled) return;
    gsap.to(taglineRef.current, { autoAlpha: 1, duration: 0.5, ease: "sine.out" });
  };

  const handleMouseLeave = () => {
    // Return to "etched" state
    gsap.to(taglineRef.current, { autoAlpha: 0.3, duration: 0.5, ease: "sine.in" });
  };

  return (
    <div 
      ref={containerRef}
      className="fixed inset-0 z-50 flex items-center justify-center border-none outline-none"
      // Strictly gate pointer events: NONE until Step 8 is complete (hoverEnabled = true)
      style={{ 
        pointerEvents: hoverEnabled ? 'auto' : 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        margin: 0,
        padding: 0
      }}
    >
      <div 
        className="relative border-none outline-none overflow-hidden logo-container"
        style={{
          position: 'relative',
          width: '85vw',
          maxWidth: '600px',
          aspectRatio: '2 / 1',
          minHeight: '180px',
          maxHeight: '300px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center'
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* "Final Archive" - Top part of logo (clip-path shows only top ~55%) */}
        <img
          ref={titleRef}
          src={logoSrc}
          alt="Final Archive"
          className="border-none outline-none ring-0 shadow-none pointer-events-none"
          style={{
            border: 'none',
            outline: 'none',
            maxWidth: '100%',
            maxHeight: '100%',
            width: 'auto',
            height: 'auto',
            display: 'none', // GSAP will control visibility
            objectFit: 'contain',
            objectPosition: 'center center',
            clipPath: 'inset(0% 0% 45% 0%)', // Show only top 55% (Final Archive part)
            WebkitClipPath: 'inset(0% 0% 45% 0%)',
            opacity: 0,
            visibility: 'hidden',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0
          }}
          aria-hidden="true"
        />

        {/* "For All Eternity" - Bottom part of logo (clip-path shows only bottom ~45%) */}
        <img
          ref={taglineRef}
          src={logoSrc}
          alt="For All Eternity"
          className="border-none outline-none ring-0 shadow-none pointer-events-none"
          style={{
            border: 'none',
            outline: 'none',
            maxWidth: '100%',
            maxHeight: '100%',
            width: 'auto',
            height: 'auto',
            display: 'none', // GSAP will control visibility
            objectFit: 'contain',
            objectPosition: 'center center',
            clipPath: 'inset(55% 0% 0% 0%)', // Show only bottom 45% (For All Eternity part)
            WebkitClipPath: 'inset(55% 0% 0% 0%)',
            opacity: 0,
            visibility: 'hidden',
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0
          }}
          aria-hidden="true"
        />
      </div>
    </div>
  );
};