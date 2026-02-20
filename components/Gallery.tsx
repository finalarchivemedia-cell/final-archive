import React, { useEffect, useRef, useCallback } from 'react';
import gsap from 'gsap';
import { AppSettings, ImageRecord } from '../types';

/**
 * Gallery – smooth Ken-Burns background slideshow
 *
 * Architecture:
 *   Two <img> / <video> layers (A & B) stacked absolutely.
 *   An imperative loop (no React state in the hot path) drives:
 *     1. Load next image into the hidden layer
 *     2. Once decoded, crossfade + zoom
 *     3. Swap roles, repeat
 *
 *   All mutable data lives in refs so nothing triggers re-renders
 *   or timeline kills mid-animation.
 */

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

/* ── helpers ─────────────────────────────────────────────── */

const pickRandom = (images: ImageRecord[], excludeId?: string): ImageRecord => {
  const pool = images.filter(img => img.id !== excludeId);
  if (pool.length === 0) return images[0];
  return pool[Math.floor(Math.random() * pool.length)];
};

/** Preload an image and resolve when fully decoded */
const preloadImage = (url: string): Promise<void> =>
  new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      if ('decode' in img) {
        img.decode().then(() => resolve()).catch(() => resolve());
      } else {
        resolve();
      }
    };
    img.onerror = () => resolve(); // don't block on error
    img.src = url;
  });

/* ── component ───────────────────────────────────────────── */

export const Gallery: React.FC<GalleryProps> = ({ 
  settings, 
  images, 
  startRecord,
  nextRecord,
  onFirstCycleComplete,
  active,
  singleMode = false,
  onImageChange,
}) => {
  /* DOM refs for the two layers */
  const layerARef = useRef<HTMLImageElement | HTMLVideoElement | null>(null);
  const layerBRef = useRef<HTMLImageElement | HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  /* Mutable state that must NOT trigger re-renders */
  const running = useRef(false);
  const cancelled = useRef(false);
  const cycleIndex = useRef(0);        // 0 = first image ever shown
  const zoomIn = useRef(true);         // true → start zoomed-in, breathe out
  const currentRecord = useRef<ImageRecord>(startRecord);
  const nextRecordRef = useRef<ImageRecord>(nextRecord);
  const settingsRef = useRef(settings);
  const imagesRef = useRef(images);
  const onFirstCycleRef = useRef(onFirstCycleComplete);
  const onImageChangeRef = useRef(onImageChange);
  const lastReportedId = useRef<string | null>(null);

  /* Keep refs in sync with props (no re-renders) */
  useEffect(() => { settingsRef.current = settings; }, [settings]);
  useEffect(() => { imagesRef.current = images; }, [images]);
  useEffect(() => { onFirstCycleRef.current = onFirstCycleComplete; }, [onFirstCycleComplete]);
  useEffect(() => { onImageChangeRef.current = onImageChange; }, [onImageChange]);

  /* ── The imperative animation loop ─────────────────────── */
  const runLoop = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    cancelled.current = false;

    // Determine which layer is "front" and which is "back"
    let frontLayer = layerARef.current;
    let backLayer = layerBRef.current;
    let isFrontA = true;
    
    if (!frontLayer || (!backLayer && !singleMode)) {
      running.current = false;
      return;
    }

    /* ── Show the very first image ─────────────────────── */
    const firstUrl = currentRecord.current.url;
    const isFirstVideo = currentRecord.current.mediaType === 'VIDEO';

    // Set source on front layer
    if (!isFirstVideo && frontLayer instanceof HTMLImageElement) {
      frontLayer.src = firstUrl;
    } else if (isFirstVideo && frontLayer instanceof HTMLVideoElement) {
      frontLayer.src = firstUrl;
        }
        
    // Preload first image
    if (!isFirstVideo) {
      await preloadImage(firstUrl);
    }
    if (cancelled.current) return;

    // Report URL
    if (currentRecord.current.id !== lastReportedId.current) {
      lastReportedId.current = currentRecord.current.id;
      onImageChangeRef.current?.(currentRecord.current.id);
      }

    const dur = settingsRef.current.duration;
    const maxScale = Math.max(1.25, 1 / Math.max(0.1, settingsRef.current.crop));
    const startScale = zoomIn.current ? maxScale : 1;
    const endScale = zoomIn.current ? 1 : maxScale;

    // Initial state: front visible, back hidden
    gsap.set(frontLayer, {
      autoAlpha: 0,
      scale: startScale,
      zIndex: 10,
      transformOrigin: 'center center',
      force3D: true,
    });
    if (backLayer) {
      gsap.set(backLayer, {
        autoAlpha: 0,
        zIndex: 5,
        force3D: true,
      });
    }

    // Fade in first image + zoom
    await gsap.to(frontLayer, {
      autoAlpha: 1,
      scale: endScale,
      duration: dur,
      ease: 'power1.inOut',
      force3D: true,
    });

    if (cancelled.current) return;

    // First cycle complete
    cycleIndex.current = 1;
    onFirstCycleRef.current();

    // Toggle zoom direction for next
    zoomIn.current = !zoomIn.current;

    // If single mode, just hold — no loop
    if (singleMode) {
      running.current = false;
      return;
    }

    /* ── Continuous loop ───────────────────────────────── */
    while (!cancelled.current) {
      // Pick next image
      const next = nextRecordRef.current || pickRandom(imagesRef.current, currentRecord.current.id);

      // Set source on back layer (hidden)
      if (backLayer instanceof HTMLImageElement) {
        backLayer.src = next.url;
      }

      // Preload next image while current is still showing
      if (next.mediaType === 'IMAGE') {
        await preloadImage(next.url);
      }
      if (cancelled.current) break;

      // Read fresh settings for this cycle
      const cycleDur = settingsRef.current.duration;
      const cycleMaxScale = Math.max(1.25, 1 / Math.max(0.1, settingsRef.current.crop));
      const cycleStartScale = zoomIn.current ? cycleMaxScale : 1;
      const cycleEndScale = zoomIn.current ? 1 : cycleMaxScale;

      // Prepare back layer at correct starting scale, invisible
      gsap.set(backLayer, {
        autoAlpha: 0,
        scale: cycleStartScale,
        zIndex: 15,
        transformOrigin: 'center center',
        force3D: true,
      });

      // Crossfade duration (2 seconds overlap)
      const crossDur = Math.min(2.0, cycleDur * 0.4);

      // Create a single timeline for the crossfade
      const tl = gsap.timeline();

      // Simultaneously: fade out front, fade in back
      tl.to(frontLayer, {
        autoAlpha: 0,
        duration: crossDur,
        ease: 'power1.inOut',
        force3D: true,
      }, 0);

      tl.to(backLayer, {
        autoAlpha: 1,
        duration: crossDur,
        ease: 'power1.inOut',
        force3D: true,
      }, 0);

      // Wait for crossfade to finish
      await tl;
      if (cancelled.current) break;

      // Report new image URL
      if (next.id !== lastReportedId.current) {
        lastReportedId.current = next.id;
        onImageChangeRef.current?.(next.id);
      }

      // Update records
      currentRecord.current = next;
      nextRecordRef.current = pickRandom(imagesRef.current, next.id);

      // Now back layer is visible — zoom it for the full display duration
      // Front layer is hidden, swap z-indices
      gsap.set(frontLayer, { zIndex: 5 });
      gsap.set(backLayer, { zIndex: 10 });

      // Zoom the now-visible back layer
      await gsap.to(backLayer, {
        scale: cycleEndScale,
        duration: cycleDur,
        ease: 'power1.inOut',
        force3D: true,
      });

      if (cancelled.current) break;

      // Toggle zoom direction
      zoomIn.current = !zoomIn.current;
      cycleIndex.current += 1;

      // Swap layer roles for next iteration
      const temp = frontLayer;
      frontLayer = backLayer;
      backLayer = temp;
      isFrontA = !isFrontA;
    }

    running.current = false;
  }, [singleMode]);

  /* ── Start / stop the loop based on `active` ───────── */
  useEffect(() => {
    if (active && !running.current) {
      cancelled.current = false;
      runLoop();
    }
    return () => {
      cancelled.current = true;
      // Kill all GSAP tweens on both layers to prevent orphaned animations
      if (layerARef.current) gsap.killTweensOf(layerARef.current);
      if (layerBRef.current) gsap.killTweensOf(layerBRef.current);
    };
  }, [active, runLoop]);

  /* ── Shared styles ─────────────────────────────────── */
  const layerStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    objectPosition: 'center center',
    opacity: 0,
    visibility: 'hidden',
    border: 'none',
    outline: 'none',
    margin: 0,
    padding: 0,
    display: 'block',
    willChange: 'transform, opacity',
    transform: 'translateZ(0)',
    backfaceVisibility: 'hidden',
    WebkitBackfaceVisibility: 'hidden',
  };

  return (
    <div 
      ref={containerRef} 
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        background: '#000',
        zIndex: 0,
        userSelect: 'none',
        WebkitUserSelect: 'none',
        display: active ? 'block' : 'none',
      }}
    >
      {/* Layer A */}
      {startRecord.mediaType === 'VIDEO' ? (
          <video
          ref={(el) => { layerARef.current = el; }}
          style={layerStyle}
            muted
            playsInline
            loop
            autoPlay
            preload="metadata"
          />
        ) : (
        <img
          ref={(el) => { layerARef.current = el; }}
          alt=""
          draggable={false}
          style={layerStyle}
            decoding="async"
          loading="eager"
          fetchPriority="high"
          />
      )}
      
      {/* Layer B */}
      {!singleMode && (
        nextRecord.mediaType === 'VIDEO' ? (
          <video
            ref={(el) => { layerBRef.current = el; }}
            style={layerStyle}
            muted
            playsInline
            loop
            autoPlay
            preload="metadata"
          />
        ) : (
        <img
            ref={(el) => { layerBRef.current = el; }}
          alt=""
          draggable={false}
            style={layerStyle}
            decoding="async"
            loading="eager"
          />
        )
      )}
    </div>
  );
};
