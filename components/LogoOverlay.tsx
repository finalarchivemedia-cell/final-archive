import React, { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { LOGO_PATH } from '../constants';

interface LogoOverlayProps {
  onIntroComplete: () => void;
  hoverEnabled: boolean;
}

export const LogoOverlay: React.FC<LogoOverlayProps> = ({ onIntroComplete, hoverEnabled }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLImageElement>(null); // "Final Archive Media" (top part)
  const taglineRef = useRef<HTMLImageElement>(null); // "For All Eternity" (bottom part)
  const tlRef = useRef<gsap.core.Timeline | null>(null);
  const [logoLoaded, setLogoLoaded] = useState(false);
  // Use LOGO_PATH directly (no cache-busting) to match preload in index.html
  // Cache headers in _headers file handle cache control
  const logoSrc = LOGO_PATH;

  // Load logo image with preload optimization
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      // Ensure image is fully decoded
      if ('decode' in img) {
        img.decode().then(() => setLogoLoaded(true)).catch(() => setLogoLoaded(true));
      } else {
        setLogoLoaded(true);
      }
    };
    img.onerror = () => {
      console.warn('[LogoOverlay] Failed to load logo, using fallback');
      setLogoLoaded(true); // Still proceed with animation
    };
    img.src = logoSrc;
  }, [logoSrc]);

  useEffect(() => {
    if (!logoLoaded) return; // Wait for logo to load
    
    // Master Timeline - Client Requirements: EXACT 6-Step Sequence
    // Each step must fully finish before the next step begins
    const tl = gsap.timeline({
      onComplete: () => {
        onIntroComplete();
      },
    });
    tlRef.current = tl;

    // Initial State: Both parts hidden, black screen
    gsap.set([titleRef.current, taglineRef.current], { 
      autoAlpha: 0,
      opacity: 0,
      visibility: 'hidden',
      display: 'none'
    });
    
    // Step 1: Show black screen for 1 second (exact delay)
    tl.to({}, { duration: 1 });
    
    // Step 2: "Final Archive Media" (top part) fades in over 1 second, centered
    tl.set(titleRef.current, { 
      display: 'block',
      visibility: 'visible'
    });
    tl.to(titleRef.current, { 
      autoAlpha: 1, 
      opacity: 1,
      duration: 1, 
      ease: "power2.inOut" // Smooth fade
    });

    // Step 3: Hold "Final Archive Media" for 3 seconds (exact)
    tl.to({}, { duration: 3 });

    // Step 4: "For All Eternity" (bottom part) fades in underneath over 1 second, styled dimmed/etched
    tl.set(taglineRef.current, { 
      display: 'block',
      visibility: 'visible',
      autoAlpha: 0,
      opacity: 0
    });
    tl.to(taglineRef.current, { 
      autoAlpha: 0.3, // Faint etched style (30% opacity)
      opacity: 0.3,
      duration: 1, 
      ease: "power2.inOut"
    });

    // Step 5: "Final Archive Media" fades out over 2 seconds
    tl.to(titleRef.current, { 
      autoAlpha: 0, 
      opacity: 0,
      duration: 2, 
      ease: "power2.inOut" 
    });

    // Step 6: "For All Eternity" remains permanently visible in faint etched style (already at 0.3 opacity)
    // No additional animation - it stays at 0.3 opacity

    return () => {
      if (tlRef.current) tlRef.current.kill();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logoLoaded]); // Run when logo is loaded

  // Hover Interaction (Gated by hoverEnabled - Step 8, after first photo sequence)
  const handleMouseEnter = () => {
    if (!hoverEnabled) return;
    gsap.to(taglineRef.current, { 
      autoAlpha: 1, 
      opacity: 1,
      duration: 0.5, 
      ease: "power2.out" 
    });
  };

  const handleMouseLeave = () => {
    // Return to "etched" state (0.3 opacity)
    gsap.to(taglineRef.current, { 
      autoAlpha: 0.3, 
      opacity: 0.3,
      duration: 0.5, 
      ease: "power2.in" 
    });
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
        padding: 0,
        backgroundColor: '#000' // Ensure black background
      }}
    >
      <div 
        className="relative border-none outline-none overflow-hidden logo-container"
        style={{
          position: 'relative',
          width: '85vw',
          maxWidth: '600px',
          aspectRatio: '3 / 1', // Adjusted for new SVG aspect ratio (1200x400 = 3:1)
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
        {/* "Final Archive Media" - Top part of logo SVG */}
        {/* SVG structure: "Final Archive Media" at y=160, "For All Eternity" at y=260, total height=400 */}
        {/* Clip to show top ~40% (0 to ~160px of 400px) */}
        <img
          ref={titleRef}
          src={logoSrc}
          alt="Final Archive Media"
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
            clipPath: 'inset(0% 0% 60% 0%)', // Show top 40% (Final Archive Media)
            WebkitClipPath: 'inset(0% 0% 60% 0%)',
            opacity: 0,
            visibility: 'hidden',
            position: 'absolute',
            top: 0,
            left: '50%',
            transform: 'translateX(-50%)',
            willChange: 'opacity' // Performance optimization
          }}
          aria-hidden="true"
        />

        {/* "For All Eternity" - Bottom part of logo SVG */}
        {/* Clip to show bottom ~60% (from ~160px to 400px) */}
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
            clipPath: 'inset(40% 0% 0% 0%)', // Show bottom 60% (For All Eternity)
            WebkitClipPath: 'inset(40% 0% 0% 0%)',
            opacity: 0,
            visibility: 'hidden',
            position: 'absolute',
            bottom: 0,
            left: '50%',
            transform: 'translateX(-50%)',
            willChange: 'opacity' // Performance optimization
          }}
          aria-hidden="true"
        />
      </div>
    </div>
  );
};