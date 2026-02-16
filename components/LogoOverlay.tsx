import React, { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';

interface LogoOverlayProps {
  onIntroComplete: () => void;
  hoverEnabled: boolean;
}

export const LogoOverlay: React.FC<LogoOverlayProps> = ({ onIntroComplete, hoverEnabled }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<SVGSVGElement>(null);
  const taglineRef = useRef<SVGSVGElement>(null);
  const tlRef = useRef<gsap.core.Timeline | null>(null);
  const [logoLoaded, setLogoLoaded] = useState(false);

  // Vector text logo is immediate
  useEffect(() => {
    setLogoLoaded(true);
  }, []);

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
        {/* Top Part: "Final Archive" (vector text) */}
        <svg
          ref={titleRef}
          className="absolute border-none outline-none ring-0 shadow-none pointer-events-none"
          viewBox="0 0 1000 500"
          style={{
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
          aria-hidden="true"
        >
          <text
            x="500"
            y="240"
            textAnchor="middle"
            fontFamily="Times New Roman, Times, serif"
            fontSize="150"
            fontStyle="italic"
            fill="#f2f2f2"
            letterSpacing="2"
          >
            Final Archive
          </text>
        </svg>

        {/* Bottom Part: "For All Eternity" (vector text) */}
        <svg
          ref={taglineRef}
          className="absolute border-none outline-none ring-0 shadow-none pointer-events-none"
          viewBox="0 0 1000 500"
          style={{
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
            mixBlendMode: 'screen',
            filter: 'contrast(1.2) sepia(0.2)',
            opacity: 0,
            visibility: 'hidden',
            pointerEvents: 'none'
          }}
          aria-hidden="true"
        >
          <text
            x="500"
            y="320"
            textAnchor="middle"
            fontFamily="Times New Roman, Times, serif"
            fontSize="60"
            fontStyle="italic"
            fill="#f2f2f2"
            letterSpacing="6"
          >
            For All Eternity
          </text>
        </svg>
      </div>
    </div>
  );
};