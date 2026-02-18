import React, { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { LOGO_PATH } from '../constants';

interface LogoOverlayProps {
  onIntroComplete: () => void;
  hoverEnabled: boolean;
}

export const LogoOverlay: React.FC<LogoOverlayProps> = ({ onIntroComplete, hoverEnabled }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLImageElement>(null);
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
    
    // Master Timeline - Strict Sequencing (logo.svg contains both "Final Archive Media" and "For All Eternity")
    const tl = gsap.timeline({
      onComplete: () => {
        onIntroComplete();
      },
    });
    tlRef.current = tl;

    // Initial State: Logo hidden
    gsap.set(logoRef.current, { 
      autoAlpha: 0,
      opacity: 0,
      visibility: 'hidden',
      display: 'none'
    });
    
    // Step 1: Black screen hold 1s (Delay start of next tween)
    
    // Step 2: Logo (contains "Final Archive Media") fades in over 1s
    tl.set(logoRef.current, { 
      display: 'block',
      visibility: 'visible'
    });
    tl.to(logoRef.current, { 
      autoAlpha: 1, 
      opacity: 1,
      duration: 1, 
      ease: "sine.inOut" 
    }, "+=1.0"); // The +=1.0 is the Step 1 delay

    // Step 3: Hold logo for 3s (both parts visible)
    tl.to({}, { duration: 3 });

    // Step 4: Logo already contains "For All Eternity" - no separate fade needed
    // (Both parts are already visible from Step 2)
    tl.to({}, { duration: 1 });

    // Step 5: Logo fades out over 2s (but we'll keep it faint for Step 6)
    // Actually, we fade to faint instead of completely out
    tl.to(logoRef.current, { 
      autoAlpha: 0.3, 
      opacity: 0.3,
      duration: 2, 
      ease: "sine.inOut" 
    });

    // Step 6: Logo remains faint permanently (showing "For All Eternity" part faintly)
    // Already set in Step 5

    return () => {
      tl.kill();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logoLoaded]); // Run when logo is loaded

  // Hover Interaction (Gated by hoverEnabled - Step 8)
  const handleMouseEnter = () => {
    if (!hoverEnabled) return;
    gsap.to(logoRef.current, { autoAlpha: 1, duration: 0.5, ease: "sine.out" });
  };

  const handleMouseLeave = () => {
    // Return to "etched" state
    gsap.to(logoRef.current, { autoAlpha: 0.3, duration: 0.5, ease: "sine.in" });
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
        {/* Logo Image - Contains both "Final Archive Media" and "For All Eternity" */}
        <img
          ref={logoRef}
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
            opacity: 0,
            visibility: 'hidden'
          }}
          aria-hidden="true"
        />
      </div>
    </div>
  );
};