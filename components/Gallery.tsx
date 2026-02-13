import React, { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { AppSettings, ImageRecord } from '../types';

interface GalleryProps {
  settings: AppSettings;
  images: ImageRecord[]; 
  startRecord: ImageRecord; 
  nextRecord: ImageRecord; 
  onFirstCycleComplete: () => void;
  active: boolean; 
  singleMode?: boolean;
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
  active 
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const layerRefA = useRef<HTMLElement | null>(null);
  const layerRefB = useRef<HTMLElement | null>(null);

  const [activeLayer, setActiveLayer] = useState<'A' | 'B'>('A');
  
  // Initialize directly with props to ensure immediate readiness
  const [currentImg, setCurrentImg] = useState<ImageRecord | null>(startRecord);
  const [nextImg, setNextImg] = useState<ImageRecord | null>(nextRecord);
  
  // Logic Refs
  const cycleCount = useRef(0);
  const zoomInRef = useRef(true);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);

  // 1. Initialization
  useEffect(() => {
    if (startRecord) setCurrentImg(startRecord);
    if (nextRecord) setNextImg(nextRecord);
  }, [startRecord, nextRecord]);

  // 2. Main Animation Loop
  useEffect(() => {
    if (!active || !currentImg || (!nextImg && !singleMode)) return;

    if (timelineRef.current) timelineRef.current.kill();

    const duration = settings.duration;
    // Calculate max scale based on crop setting (ensure minimum 1.25)
    const maxScale = Math.max(1.25, 1 / Math.max(0.1, settings.crop));
    
    const currentEl = activeLayer === 'A' ? layerRefA.current : layerRefB.current;
    const nextEl = activeLayer === 'A' ? layerRefB.current : layerRefA.current;
    
    if (!currentEl || (!nextEl && !singleMode)) return;

    // Reset Z-Index and Visibility
    gsap.set(currentEl, { zIndex: 10, autoAlpha: 1 });
    if (!singleMode && nextEl) {
      gsap.set(nextEl, { zIndex: 5, autoAlpha: 0 }); 
    }

    const tl = gsap.timeline({
      onComplete: () => {
        cycleCount.current += 1;
        if (cycleCount.current === 1) {
          onFirstCycleComplete();
        }

        if (!singleMode && nextImg) {
          const nextLoopRecord = getRandomImage(images, nextImg.id);
          setActiveLayer(prev => prev === 'A' ? 'B' : 'A');
          setCurrentImg(nextImg); 
          if (nextLoopRecord) setNextImg(nextLoopRecord); 
        }
        zoomInRef.current = !zoomInRef.current;
      }
    });
    timelineRef.current = tl;

    const moveDuration = duration + 2.0;

    if (zoomInRef.current) {
      tl.fromTo(currentEl, 
        { scale: maxScale }, 
        { scale: 1, duration: moveDuration, ease: "sine.inOut" },
        0
      );
    } else {
      tl.fromTo(currentEl, 
        { scale: 1 }, 
        { scale: maxScale, duration: moveDuration, ease: "sine.inOut" },
        0
      );
    }

    if (!singleMode && nextEl) {
      // Crossfade
      tl.to(currentEl, {
        autoAlpha: 0,
        duration: 2.0,
        ease: "sine.inOut"
      }, duration);

      tl.to(nextEl, {
        autoAlpha: 1,
        duration: 2.0,
        ease: "sine.inOut"
      }, duration);
    }

    // Initial Fade In for first cycle (Step 7)
    if (cycleCount.current === 0) {
      gsap.set(currentEl, { autoAlpha: 0 });
      gsap.to(currentEl, { autoAlpha: 1, duration: 2.0, ease: "sine.inOut" });
    }
    
    return () => {
      tl.kill();
    };
  }, [active, activeLayer, currentImg, nextImg, settings, images, onFirstCycleComplete, singleMode]);

  // Determine URLs for rendering
  const urlA = activeLayer === 'A' ? currentImg?.url : nextImg?.url;
  const urlB = activeLayer === 'B' ? currentImg?.url : nextImg?.url;
  const typeA = activeLayer === 'A' ? currentImg?.mediaType : nextImg?.mediaType;
  const typeB = activeLayer === 'B' ? currentImg?.mediaType : nextImg?.mediaType;

  const baseMediaStyle: React.CSSProperties = {
    border: 'none',
    outline: 'none',
    boxShadow: 'none',
    margin: 0,
    padding: 0,
    display: 'block',
    opacity: 0, // Controlled by GSAP
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
            className="absolute inset-0 w-full h-full object-cover will-change-transform"
            style={{
              ...baseMediaStyle,
              objectPosition: 'center center',
              minWidth: '100%',
              minHeight: '100%',
            }}
            muted
            playsInline
            loop
            autoPlay
            preload="metadata"
            poster={typeA === 'VIDEO' ? `${urlA}#t=0.1` : undefined}
          />
        ) : (
        <img
            ref={(el) => { layerRefA.current = el; }}
          src={urlA}
          className="absolute inset-0 w-full h-full object-cover will-change-transform"
          alt=""
          draggable={false}
            style={{
              ...baseMediaStyle,
              objectPosition: 'center center',
              minWidth: '100%',
              minHeight: '100%',
            }}
            decoding="async"
          />
        )
      )}
      
      {/* Layer B - Only render if URL exists */}
      {!singleMode && urlB && (
        typeB === 'VIDEO' ? (
          <video
            ref={(el) => { layerRefB.current = el; }}
            src={urlB}
            className="absolute inset-0 w-full h-full object-cover will-change-transform"
            style={{
              ...baseMediaStyle,
              objectPosition: 'center center',
              minWidth: '100%',
              minHeight: '100%',
            }}
            muted
            playsInline
            loop
            autoPlay
            preload="metadata"
            poster={typeB === 'VIDEO' ? `${urlB}#t=0.1` : undefined}
          />
        ) : (
        <img
            ref={(el) => { layerRefB.current = el; }}
          src={urlB}
          className="absolute inset-0 w-full h-full object-cover will-change-transform"
          alt=""
          draggable={false}
            style={{
              ...baseMediaStyle,
              objectPosition: 'center center',
              minWidth: '100%',
              minHeight: '100%',
            }}
            decoding="async"
          />
        )
      )}
    </div>
  );
};