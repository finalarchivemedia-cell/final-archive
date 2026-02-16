import React, { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { LOGO_PATH } from '../constants';

interface LogoOverlayProps {
  onIntroComplete: () => void;
  hoverEnabled: boolean;
}

export const LogoOverlay: React.FC<LogoOverlayProps> = ({ onIntroComplete, hoverEnabled }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLImageElement>(null);
  const taglineRef = useRef<HTMLImageElement>(null);
  const tlRef = useRef<gsap.core.Timeline | null>(null);
  const [logoSrc, setLogoSrc] = useState<string>('/logo.svg');
  const [logoLoaded, setLogoLoaded] = useState(false);

  // Preload logo image (only once)
  useEffect(() => {
    if (logoLoaded) return; // Prevent duplicate loading
    
    // Try loading logo.svg first
    const img = new Image();
    img.src = '/logo.svg';
    
    img.onload = () => {
      console.log('[LogoOverlay] Logo loaded successfully: /logo.svg');
      setLogoLoaded(true);
      setLogoSrc('/logo.svg');
    };
    
    img.onerror = () => {
      console.warn('[LogoOverlay] Failed to load /logo.svg, trying fallback');
      const fallbackImg = new Image();
      fallbackImg.src = LOGO_PATH;
      fallbackImg.onload = () => {
        console.log('[LogoOverlay] Logo loaded from fallback:', LOGO_PATH);
        setLogoLoaded(true);
        setLogoSrc(LOGO_PATH);
      };
      fallbackImg.onerror = () => {
        console.error('[LogoOverlay] Failed to load logo from both sources');
        setLogoLoaded(true);
        setLogoSrc(LOGO_PATH);
      };
    };
  }, [logoLoaded]);

  useEffect(() => {
    if (!logoLoaded) return; // Wait for logo to load
    
    // CRITICAL: Ensure tagline is completely hidden before timeline starts
    if (taglineRef.current) {
      gsap.set(taglineRef.current, { 
        autoAlpha: 0,
        opacity: 0,
        visibility: 'hidden'
      });
    }
    
    // Master Timeline - Strict Sequencing
    const tl = gsap.timeline({
      onComplete: () => {
        onIntroComplete();
      },
    });
    tlRef.current = tl;

    // Initial State: All hidden (ensure both are set)
    gsap.set([titleRef.current, taglineRef.current], { 
      autoAlpha: 0,
      opacity: 0,
      visibility: 'hidden'
    });
    
    // Step 1: Black screen hold 1s (Delay start of next tween)
    
    // Step 2: "Final Archive" fades in over 1s
    tl.to(titleRef.current, { 
      autoAlpha: 1, 
      opacity: 1,
      duration: 1, 
      ease: "sine.inOut" 
    }, "+=1.0"); // The +=1.0 is the Step 1 delay

    // Step 3: Hold "Final Archive" for 3s
    tl.to({}, { duration: 3 });

    // Step 4: "For All Eternity" fades in over 1s (to full visibility initially)
    // CRITICAL: Make visible first, then fade in
    tl.set(taglineRef.current, { 
      visibility: 'visible',
      opacity: 0,
      autoAlpha: 0
    });
    tl.to(taglineRef.current, { 
      autoAlpha: 1,
      opacity: 1,
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

    // Step 6: Tagline remains faint permanently (no extra time)
    tl.set(taglineRef.current, { 
      autoAlpha: 0.3, // Etched opacity
      opacity: 0.3
    });

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
          position: 'relative'
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Top Part: "Final Archive" (vector SVG image) */}
        <img
          ref={titleRef}
          src={logoSrc || LOGO_PATH}
          alt=""
          className="absolute border-none outline-none ring-0 shadow-none pointer-events-none"
          style={{
            // Show top 60% - better clipping for both mobile and web
            clipPath: 'polygon(0% 0%, 100% 0%, 100% 60%, 0% 60%)',
            WebkitClipPath: 'polygon(0% 0%, 100% 0%, 100% 60%, 0% 60%)',
            objectPosition: 'center center',
            objectFit: 'contain',
            border: 'none',
            outline: 'none',
            maxWidth: '100%',
            maxHeight: '100%',
            width: '100%',
            height: '100%',
            display: 'block',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            margin: 'auto',
            visibility: logoLoaded ? 'visible' : 'hidden'
          }}
          onLoad={() => {
            if (!logoLoaded) setLogoLoaded(true);
          }}
          onError={() => {
            if (logoSrc !== LOGO_PATH) setLogoSrc(LOGO_PATH);
            if (!logoLoaded) setLogoLoaded(true);
          }}
          draggable={false}
        />

        {/* Bottom Part: "For All Eternity" (vector SVG image) */}
        <img
          ref={taglineRef}
          src={logoSrc || LOGO_PATH}
          alt=""
          className="absolute border-none outline-none ring-0 shadow-none pointer-events-none"
          style={{
            // Show bottom 40% - better clipping for both mobile and web
            clipPath: 'polygon(0% 60%, 100% 60%, 100% 100%, 0% 100%)',
            WebkitClipPath: 'polygon(0% 60%, 100% 60%, 100% 100%, 0% 100%)',
            objectPosition: 'center center',
            objectFit: 'contain',
            filter: 'contrast(1.2) sepia(0.2)',
            mixBlendMode: 'screen',
            border: 'none',
            outline: 'none',
            maxWidth: '100%',
            maxHeight: '100%',
            width: '100%',
            height: '100%',
            display: 'block',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            margin: 'auto',
            opacity: 0,
            visibility: 'hidden',
            pointerEvents: 'none'
          }}
          onLoad={() => {
            if (!logoLoaded) setLogoLoaded(true);
          }}
          onError={() => {
            if (logoSrc !== LOGO_PATH) setLogoSrc(LOGO_PATH);
            if (!logoLoaded) setLogoLoaded(true);
          }}
          draggable={false}
        />
      </div>
    </div>
  );
};