import React, { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { AppSettings, ImageRecord } from '../types';

// Gallery component for background media display

interface GalleryProps {
  settings: AppSettings;
  images: ImageRecord[]; 
  startRecord: ImageRecord; 
  nextRecord: ImageRecord; 
  onFirstCycleComplete: () => void;
  active: boolean; 
  singleMode?: boolean;
  onImageChange?: (id: string) => void;
}

// Helper to get random image excluding current
const getRandomImage = (images: ImageRecord[], excludeId?: string): ImageRecord | null => {
  if (!images || images.length === 0) return null;
  const pool = images.filter(img => img.id !== excludeId);
  if (pool.length === 0) return images[0];
  return pool[Math.floor(Math.random() * pool.length)];
};

export const Gallery: React.FC<GalleryProps> = ({ 
  settings, 
  images, 
  startRecord,
  nextRecord,
  onFirstCycleComplete,
  active,
  singleMode = false,
  onImageChange
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const layerRefA = useRef<HTMLElement | null>(null);
  const layerRefB = useRef<HTMLElement | null>(null);
  const [layerAReady, setLayerAReady] = useState(false);
  const [layerBReady, setLayerBReady] = useState(false);

  const [activeLayer, setActiveLayer] = useState<'A' | 'B'>('A');
  
  // Initialize directly with props to ensure immediate readiness
  const [currentImg, setCurrentImg] = useState<ImageRecord | null>(startRecord);
  const [nextImg, setNextImg] = useState<ImageRecord | null>(nextRecord);
  
  // Logic Refs
  const cycleCount = useRef(0);
  // Client requirement: First image starts zoomed in and breathes out
  // So initial state: true = zoomed in (maxScale) → zoom out to 1
  const zoomInRef = useRef(true); // true = start zoomed in, false = start at full frame
  const timelineRef = useRef<gsap.core.Timeline | null>(null);
  const lastImageIdRef = useRef<string | null>(null); // Track last image ID to prevent duplicate URL updates

  // 1. Initialization
  useEffect(() => {
    if (startRecord) {
      setCurrentImg(startRecord);
      // Initialize lastImageIdRef to prevent duplicate URL update on mount
      if (startRecord.id !== lastImageIdRef.current) {
        lastImageIdRef.current = startRecord.id;
      }
    }
    if (nextRecord) setNextImg(nextRecord);
  }, [startRecord, nextRecord]);

  // 2. Main Animation Loop
  useEffect(() => {
    const currentReady = activeLayer === 'A' ? layerAReady : layerBReady;
    const nextReady = activeLayer === 'A' ? layerBReady : layerAReady;
    // Allow first image to show even if not fully ready (will fade in when ready)
    // Only block if we're waiting for next image in crossfade
    if (!active || !currentImg || (!nextImg && !singleMode)) return;
    // For first cycle, don't block on currentReady - allow immediate fade-in
    if (cycleCount.current > 0 && !currentReady) return;

    if (timelineRef.current) timelineRef.current.kill();

    const duration = settings.duration;
    // Calculate max scale based on crop setting (ensure minimum 1.25)
    const maxScale = Math.max(1.25, 1 / Math.max(0.1, settings.crop));
    
    const currentEl = activeLayer === 'A' ? layerRefA.current : layerRefB.current;
    const nextEl = activeLayer === 'A' ? layerRefB.current : layerRefA.current;
    
    if (!currentEl || (!nextEl && !singleMode)) return;

    // Reset Z-Index and Visibility - ensure smooth transitions
    // Current image always on top initially
    gsap.set(currentEl, { 
      zIndex: 10, 
      autoAlpha: 1,
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      width: '100%',
      height: '100%'
    });
    if (!singleMode && nextEl) {
      // Next image behind, ready for crossfade
      // CRITICAL: Set next image's initial scale based on NEXT zoom direction
      // This ensures smooth transition - next image starts at correct scale
      const nextZoomDirection = !zoomInRef.current; // Next image will have opposite direction
      const nextStartScale = nextZoomDirection ? maxScale : 1;
      
      gsap.set(nextEl, { 
        zIndex: 5, 
        autoAlpha: 0,
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100%',
        height: '100%',
        scale: nextStartScale, // Set correct initial scale for next image
        transformOrigin: 'center center',
        force3D: true
      }); 
    }

    const tl = gsap.timeline({
      onComplete: () => {
        if (!singleMode && !nextReady) {
          return;
        }
        cycleCount.current += 1;
        if (cycleCount.current === 1) {
          onFirstCycleComplete();
        }
        
        // CRITICAL: Toggle zoom direction BEFORE switching images
        // This ensures the next image uses the correct zoom pattern immediately
        zoomInRef.current = !zoomInRef.current;
        
        if (!singleMode && nextImg) {
          const nextLoopRecord = getRandomImage(images, nextImg.id);
          setActiveLayer(prev => prev === 'A' ? 'B' : 'A');
          setCurrentImg(nextImg); 
          if (nextLoopRecord) setNextImg(nextLoopRecord); 
        }
      }
    });
    timelineRef.current = tl;

    // Client requirement: Alternate motion style
    // Image A: starts zoomed in (maxScale) → breathes out to full frame (1)
    // Image B: starts full frame (1) → breathes in (maxScale)
    // Pattern alternates: zoom out, zoom in, zoom out, zoom in...
    const startScale = zoomInRef.current ? maxScale : 1;
    const endScale = zoomInRef.current ? 1 : maxScale;
    
    // Current image's zoom duration = display duration (not extended)
    // This ensures zoom completes before next image takes over
    const zoomDuration = duration;
    
    // CRITICAL: Set correct initial scale directly - no abrupt resets
    // This prevents screen changes and maintains smooth flow
    // Don't reset scale first as it causes visual jumps
    gsap.set(currentEl, { 
      scale: startScale, 
      autoAlpha: 1,
      transformOrigin: 'center center',
      force3D: true // Force GPU acceleration
    });

    // Smooth continuous motion - alternating zoom pattern
    // Use fromTo to ensure we start from exact startScale and end at exact endScale
    // Zoom duration = display duration (not extended) to prevent overlap
    tl.fromTo(currentEl, 
      { 
        scale: startScale,
        force3D: true
      }, 
      { 
        scale: endScale, 
        duration: zoomDuration, 
        ease: "power1.inOut", // Smooth continuous motion
        force3D: true
      },
      0
    );

    // First cycle: fade in the first image immediately
    if (cycleCount.current === 0) {
      // Ensure image is visible even if still loading
      // Start with correct scale already set above
      gsap.set(currentEl, { autoAlpha: 0 });
      tl.to(currentEl, { 
        autoAlpha: 1, 
        duration: 0.6, 
        ease: "power2.inOut" 
      }, 0);
    } else {
      // For subsequent cycles, ensure scale is reset and set correctly
      // This prevents any scale carryover from previous animations
      gsap.set(currentEl, { 
        scale: startScale,
        force3D: true
      });
    }

    if (!singleMode && nextEl && nextReady) {
      // Smooth crossfade - ensure next image is ready before starting
      // Start crossfade slightly before duration ends for seamless transition
      const crossfadeStart = Math.max(0, duration - 2.0);
      
      // Calculate next image's zoom pattern (opposite of current)
      const nextZoomDirection = !zoomInRef.current;
      const nextStartScale = nextZoomDirection ? maxScale : 1;
      const nextEndScale = nextZoomDirection ? 1 : maxScale;
      
      // Ensure next image starts at correct scale before crossfade
      tl.set(nextEl, { 
        scale: nextStartScale,
        force3D: true
      }, crossfadeStart - 0.1); // Set slightly before crossfade
      
      // Bring next image to front before crossfade
      tl.set(nextEl, { zIndex: 15 }, crossfadeStart);
      
      // Start next image's zoom animation AFTER crossfade completes
      // This prevents double zoom - current image completes, then next starts
      // Next image's zoom starts when it becomes visible (after crossfade)
      const nextZoomStart = crossfadeStart + 2.0; // After crossfade completes
      tl.fromTo(nextEl,
        {
          scale: nextStartScale,
          force3D: true
        },
        {
          scale: nextEndScale,
          duration: duration, // Same duration as display time
          ease: "power1.inOut",
          force3D: true
        },
        nextZoomStart
      );
      
      // Smooth crossfade with perfect overlap - no gaps, no flashes
      tl.to(currentEl, {
        autoAlpha: 0,
        duration: 2.0,
        ease: "power1.inOut",
        force3D: true,
        immediateRender: false
      }, crossfadeStart);

      tl.to(nextEl, {
        autoAlpha: 1,
        duration: 2.0,
        ease: "power1.inOut",
        force3D: true,
        immediateRender: false
      }, crossfadeStart);
      
      // After crossfade complete, swap z-index for next cycle
      tl.set(currentEl, { zIndex: 5 }, crossfadeStart + 2.0);
      tl.set(nextEl, { zIndex: 10 }, crossfadeStart + 2.0);
    }

    // Initial Fade In for first cycle handled in timeline (no delay)
    
    return () => {
      tl.kill();
    };
  }, [active, activeLayer, currentImg, nextImg, settings, images, onFirstCycleComplete, singleMode, layerAReady, layerBReady]);

  // Determine URLs for rendering
  const urlA = activeLayer === 'A' ? currentImg?.url : nextImg?.url;
  const urlB = activeLayer === 'B' ? currentImg?.url : nextImg?.url;
  const typeA = activeLayer === 'A' ? currentImg?.mediaType : nextImg?.mediaType;
  const typeB = activeLayer === 'B' ? currentImg?.mediaType : nextImg?.mediaType;

  useEffect(() => {
    setLayerAReady(false);
  }, [urlA]);

  useEffect(() => {
    setLayerBReady(false);
  }, [urlB]);

  // Update URL only when image actually changes (not on every render)
  // This prevents duplicate URL updates and image reloads
  useEffect(() => {
    if (currentImg?.id && currentImg.id !== lastImageIdRef.current) {
      lastImageIdRef.current = currentImg.id;
      onImageChange?.(currentImg.id);
    }
  }, [currentImg?.id, onImageChange]);

  const baseMediaStyle: React.CSSProperties = {
    border: 'none',
    outline: 'none',
    boxShadow: 'none',
    margin: 0,
    padding: 0,
    display: 'block',
    opacity: 0, // Controlled by GSAP
    willChange: 'transform, opacity', // GPU acceleration hint
    transform: 'translateZ(0)', // Force GPU layer
    backfaceVisibility: 'hidden', // Prevent flicker
    WebkitBackfaceVisibility: 'hidden',
    position: 'absolute', // Ensure no layout shifts
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover', // Ensure full coverage
    objectPosition: 'center center',
  };

  return (
    <div 
      ref={containerRef} 
      className="fixed inset-0 w-full h-full overflow-hidden bg-black z-0"
      style={{
        border: 'none !important',
        outline: 'none !important',
        boxShadow: 'none !important',
        background: '#000',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        display: active ? 'block' : 'none'
      }}
    >
      {/* Layer A - Only render if URL exists */}
      {urlA && (
        typeA === 'VIDEO' ? (
          <video
            ref={(el) => { layerRefA.current = el; }}
            src={urlA}
            style={baseMediaStyle}
            muted
            playsInline
            loop
            autoPlay
            preload="metadata"
            poster={typeA === 'VIDEO' ? `${urlA}#t=0.1` : undefined}
            onLoadedMetadata={() => {
              requestAnimationFrame(() => {
                setLayerAReady(true);
              });
            }}
          />
        ) : (
        <img
            ref={(el) => { layerRefA.current = el; }}
          src={urlA}
          alt=""
          draggable={false}
            style={baseMediaStyle}
            decoding="async"
            loading="eager"
            fetchPriority="high"
            onLoad={(e) => {
              const el = e.currentTarget;
              // Ensure image is fully decoded before marking as ready
              if ('decode' in el) {
                el.decode()
                  .then(() => {
                    // Small delay to ensure rendering is complete
                    requestAnimationFrame(() => {
                      setLayerAReady(true);
                    });
                  })
                  .catch(() => setLayerAReady(true));
              } else {
                requestAnimationFrame(() => {
                  setLayerAReady(true);
                });
              }
            }}
          />
        )
      )}
      
      {/* Layer B - Only render if URL exists */}
      {!singleMode && urlB && (
        typeB === 'VIDEO' ? (
          <video
            ref={(el) => { layerRefB.current = el; }}
            src={urlB}
            style={baseMediaStyle}
            muted
            playsInline
            loop
            autoPlay
            preload="metadata"
            poster={typeB === 'VIDEO' ? `${urlB}#t=0.1` : undefined}
            onLoadedMetadata={() => {
              requestAnimationFrame(() => {
                setLayerBReady(true);
              });
            }}
          />
        ) : (
        <img
            ref={(el) => { layerRefB.current = el; }}
          src={urlB}
          alt=""
          draggable={false}
            style={baseMediaStyle}
            decoding="async"
            loading="eager"
            fetchPriority="high"
            onLoad={(e) => {
              const el = e.currentTarget;
              // Ensure image is fully decoded before marking as ready
              if ('decode' in el) {
                el.decode()
                  .then(() => {
                    // Small delay to ensure rendering is complete
                    requestAnimationFrame(() => {
                      setLayerBReady(true);
                    });
                  })
                  .catch(() => setLayerBReady(true));
              } else {
                requestAnimationFrame(() => {
                  setLayerBReady(true);
                });
              }
            }}
          />
        )
      )}
    </div>
  );
};