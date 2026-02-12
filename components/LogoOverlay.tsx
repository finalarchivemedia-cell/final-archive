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
  const [logoSrc, setLogoSrc] = useState<string>('/logo.png');
  const [logoLoaded, setLogoLoaded] = useState(false);

  // Preload logo image (only once)
  useEffect(() => {
    if (logoLoaded) return; // Prevent duplicate loading
    
    // Try loading logo.png first
    const img = new Image();
    img.src = '/logo.png';
    
    img.onload = () => {
      console.log('[LogoOverlay] Logo loaded successfully: /logo.png');
      setLogoLoaded(true);
      setLogoSrc('/logo.png');
    };
    
    img.onerror = () => {
      console.warn('[LogoOverlay] Failed to load /logo.png, trying fallback');
      // Fallback to LOGO_PATH constant
      const fallbackImg = new Image();
      fallbackImg.src = LOGO_PATH;
      fallbackImg.onload = () => {
        console.log('[LogoOverlay] Logo loaded from fallback:', LOGO_PATH);
        setLogoLoaded(true);
        setLogoSrc(LOGO_PATH);
      };
      fallbackImg.onerror = () => {
        console.error('[LogoOverlay] Failed to load logo from both sources');
        // If both fail, still set loaded to allow timeline to start
        setLogoLoaded(true);
        setLogoSrc(LOGO_PATH);
      };
    };
  }, [logoLoaded]);

  useEffect(() => {
    if (!logoLoaded) return; // Wait for logo to load
    
    // Master Timeline - Strict Sequencing
    const tl = gsap.timeline({
      onComplete: () => {
        onIntroComplete();
      },
    });
    tlRef.current = tl;

    // Initial State: All hidden
    gsap.set([titleRef.current, taglineRef.current], { autoAlpha: 0 });
    
    // Step 1: Black screen hold 1s (Delay start of next tween)
    
    // Step 2: "Final Archive" fades in over 1s
    tl.to(titleRef.current, { 
      autoAlpha: 1, 
      duration: 1, 
      ease: "power1.inOut" 
    }, "+=1.0"); // The +=1.0 is the Step 1 delay

    // Step 3: Hold "Final Archive" for 3s
    tl.to({}, { duration: 3 });

    // Step 4: "For All Eternity" fades in over 1s (to full visibility initially)
    tl.to(taglineRef.current, { 
      autoAlpha: 1, 
      duration: 1, 
      ease: "power1.inOut" 
    });

    // Step 5: "Final Archive" fades out over 2s
    tl.to(titleRef.current, { 
      autoAlpha: 0, 
      duration: 2, 
      ease: "power1.inOut" 
    });

    // Step 6: Tagline fades to permanent faint (etched) state over 1s
    // "Tagline fades but stays..."
    tl.to(taglineRef.current, { 
      autoAlpha: 0.3, // Etched opacity
      duration: 1, 
      ease: "power1.inOut" 
    });

    return () => {
      tl.kill();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logoLoaded]); // Run when logo is loaded

  // Hover Interaction (Gated by hoverEnabled - Step 8)
  const handleMouseEnter = () => {
    if (!hoverEnabled) return;
    gsap.to(taglineRef.current, { autoAlpha: 1, duration: 0.5, ease: "power2.out" });
  };

  const handleMouseLeave = () => {
    // Return to "etched" state
    gsap.to(taglineRef.current, { autoAlpha: 0.3, duration: 0.5, ease: "power2.in" });
  };

  return (
    <div 
      ref={containerRef}
      className="fixed inset-0 z-50 flex items-center justify-center border-none outline-none"
      // Strictly gate pointer events: NONE until Step 8 is complete (hoverEnabled = true)
      style={{ pointerEvents: hoverEnabled ? 'auto' : 'none' }}
    >
      <div 
        className="relative w-[85vw] sm:w-[80vw] max-w-[600px] border-none outline-none overflow-hidden logo-container"
        style={{
          aspectRatio: '2 / 1', // Maintain logo aspect ratio
          minHeight: '180px',
          maxHeight: '300px',
          height: 'auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative'
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Single logo image container - prevents duplicate rendering */}
        {/* Always render images, visibility controlled by GSAP */}
        {/* Top Part: "Final Archive" */}
        <img 
          ref={titleRef}
          src={logoSrc || LOGO_PATH} 
          alt=""
          className="absolute inset-0 w-full h-full object-contain border-none outline-none ring-0 shadow-none pointer-events-none"
          style={{ 
            // Show top 60% - better clipping for both mobile and web
            clipPath: 'polygon(0% 0%, 100% 0%, 100% 60%, 0% 60%)',
            WebkitClipPath: 'polygon(0% 0%, 100% 0%, 100% 60%, 0% 60%)',
            objectPosition: 'center top',
            objectFit: 'contain',
            border: 'none',
            outline: 'none',
            maxWidth: '100%',
            maxHeight: '100%',
            width: '100%',
            height: '100%',
            display: 'block',
            visibility: logoLoaded ? 'visible' : 'hidden'
          }}
          onLoad={() => {
            console.log('[LogoOverlay] Title image loaded');
            if (!logoLoaded) setLogoLoaded(true);
          }}
          onError={(e) => {
            console.error('[LogoOverlay] Title image error:', e);
            if (logoSrc !== LOGO_PATH) {
              setLogoSrc(LOGO_PATH);
            }
            if (!logoLoaded) setLogoLoaded(true);
          }}
          draggable={false}
        />

        {/* Bottom Part: "For All Eternity" */}
        <img 
          ref={taglineRef}
          src={logoSrc || LOGO_PATH} 
          alt=""
          className="absolute inset-0 w-full h-full object-contain mix-blend-screen border-none outline-none ring-0 shadow-none pointer-events-none"
          style={{ 
            // Show bottom 40% - better clipping for both mobile and web
            clipPath: 'polygon(0% 60%, 100% 60%, 100% 100%, 0% 100%)',
            WebkitClipPath: 'polygon(0% 60%, 100% 60%, 100% 100%, 0% 100%)',
            objectPosition: 'center bottom',
            objectFit: 'contain',
            // Etched Look Filter (always applied, opacity controls visibility)
            filter: 'contrast(1.2) sepia(0.2)',
            border: 'none',
            outline: 'none',
            maxWidth: '100%',
            maxHeight: '100%',
            width: '100%',
            height: '100%',
            display: 'block',
            visibility: logoLoaded ? 'visible' : 'hidden'
          }}
          onLoad={() => {
            console.log('[LogoOverlay] Tagline image loaded');
            if (!logoLoaded) setLogoLoaded(true);
          }}
          onError={(e) => {
            console.error('[LogoOverlay] Tagline image error:', e);
            if (logoSrc !== LOGO_PATH) {
              setLogoSrc(LOGO_PATH);
            }
            if (!logoLoaded) setLogoLoaded(true);
          }}
          draggable={false}
        />
      </div>
    </div>
  );
};