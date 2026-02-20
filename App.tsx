import React, { useState, useEffect, Suspense, useCallback } from 'react';
import { Routes, Route, useLocation, useParams } from 'react-router-dom';
import { LogoOverlay } from './components/LogoOverlay';
import { Gallery } from './components/Gallery';
import { ContactModal } from './components/ContactModal';
import { AppSettings, DEFAULT_SETTINGS, ImageRecord } from './types';
import { fetchImageList, fetchImageById } from './services/api';
import { preloadMedia } from './services/preload';
import { ID_REGEX, MUSIC_PATH } from './constants';

// Lazy load admin to avoid bundle bloat
const AdminPanel = React.lazy(() => import('./components/AdminPanel'));

// Helper to get random image from list
const pickRandom = (list: ImageRecord[], excludeId?: string) => {
  const pool = excludeId ? list.filter(i => i.id !== excludeId) : list;
  if (!pool.length) return list[0];
  return pool[Math.floor(Math.random() * pool.length)];
};

const GalleryRouteHandler: React.FC<{
  settings: AppSettings;
  introComplete: boolean;
  images: ImageRecord[];
  onFirstCycleComplete: () => void;
}> = ({ settings, introComplete, images, onFirstCycleComplete }) => {
  const { id } = useParams();
  const location = useLocation();
  const singleMode = Boolean(id && ID_REGEX.test(id));

  const handleImageChange = useCallback((imageId: string) => {
    if (singleMode) return;
    const nextPath = `/${imageId}`;
    if (location.pathname !== nextPath) {
      window.history.replaceState(null, '', nextPath);
    }
  }, [location.pathname, singleMode]);


  // We hold the pre-resolved start sequence here
  const [readyData, setReadyData] = useState<{
    start: ImageRecord;
    next: ImageRecord;
  } | null>(null);

  const [notFound, setNotFound] = useState(false);

  // Preloading Logic: Runs immediately when component mounts (during Intro)
  useEffect(() => {
    if (images.length === 0) return;

    let isCancelled = false;

    const addPreloadLink = (url: string) => {
      if (typeof document === 'undefined') return;
      if (document.querySelector(`link[rel="preload"][href="${url}"]`)) return;
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'image';
      link.href = url;
      document.head.appendChild(link);
    };

    const prepareAssets = async () => {
      let startRecord: ImageRecord | null = null;

      // 1. Resolve Start Image
      if (id && ID_REGEX.test(id)) {
        startRecord = await fetchImageById(id);
        if (!startRecord) {
          if (!isCancelled) setNotFound(true);
          return;
        }
      } else {
        startRecord = pickRandom(images);
      }

      // 2. Resolve Next Image (only when not locked to a single ID)
      const nextRecord = id && ID_REGEX.test(id)
        ? startRecord
        : pickRandom(images, startRecord.id);

      if (startRecord.mediaType === 'IMAGE') {
        addPreloadLink(startRecord.url);
      }

      if (!isCancelled) {
        setReadyData({ start: startRecord, next: nextRecord });
      }

      // 3. Preload first image in background (do not block render)
      // Ensures Step 7 can render immediately when cache is ready
      try {
        void preloadMedia(startRecord.url);
      } catch (e) {
        console.warn('Preload warning', e);
      }

      // 4. Preload next image in background (non-blocking)
      try {
        void preloadMedia(nextRecord.url);
      } catch {
        // ignore
      }
    };

    prepareAssets();

    return () => { isCancelled = true; };
  }, [id, images]);


  // If assets aren't ready yet, show nothing (covered by LogoOverlay)
  // Or if intro is done but data failed, show error
  if (!readyData) {
    if (notFound && introComplete) {
      return <div className="fixed inset-0 flex items-center justify-center bg-black text-white/30 text-sm font-serif tracking-widest">ARCHIVE RECORD NOT FOUND</div>;
    }
    // Still loading (hidden by intro)
    return null;
  }

  // ROOT FIX: Strictly do NOT render the Gallery component until Steps 1-6 are complete.
  // This ensures pure black screen with no potential image artifacts/lines.
  if (!introComplete) {
    return null;
  }

  return (
    <Gallery
      settings={settings}
      images={singleMode ? [readyData.start] : images}
      startRecord={readyData.start}
      nextRecord={readyData.next}
      active={introComplete}
      onFirstCycleComplete={onFirstCycleComplete}
      singleMode={singleMode}
      onImageChange={handleImageChange}
    />
  );
};

export default function App() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [introComplete, setIntroComplete] = useState(false);
  const [hoverEnabled, setHoverEnabled] = useState(false);
  const [firstCycleComplete, setFirstCycleComplete] = useState(false);
  const [images, setImages] = useState<ImageRecord[]>([]);
  const [musicUrl, setMusicUrl] = useState<string | null>(null);
  const [contactOpen, setContactOpen] = useState(false);
  const location = useLocation();
  const audioRef = React.useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Performance: Parallel fetch for settings and images (non-blocking)
    // Sync public settings from backend
    const settingsPromise = import('./services/api').then(({ fetchPublicSettings }) => {
      return fetchPublicSettings().then(s => {
        if (s) {
          setSettings({
          duration: s.displayDurationSec,
          crop: s.cropPercent / 100
        });
          if (typeof s.musicUrl === 'string') {
            setMusicUrl(s.musicUrl);
          }
        }
      });
    });

    // Performance Requirement: Fetch immediately on mount
    // Do NOT wait for idle callback - critical for TTFB < 0.1s
    const imagesPromise = fetchImageList()
      .then(data => {
        console.log('[App] Images loaded:', data.length);
        setImages(data);
      })
      .catch(err => {
        console.error('[App] Failed to load images:', err);
        setImages([]);
      });

    // Execute both in parallel for faster load
    Promise.all([settingsPromise, imagesPromise]).catch(err => {
      console.error('[App] Initialization error:', err);
      });
  }, []);

  useEffect(() => {
    if (introComplete && firstCycleComplete) {
      setHoverEnabled(true);
    }
  }, [introComplete, firstCycleComplete]);

  // Background music:
  // Browsers block autoplay with sound, so we start on first user gesture.
  // Requirement: keep Step 1-6 silent/black; we enable after Step 8 gate (hoverEnabled).
  useEffect(() => {
    if (!hoverEnabled) return;
    const el = audioRef.current;
    if (!el) return;

    let started = false;
    const start = async () => {
      if (started) return;
      started = true;
      try {
        el.volume = 0.25;
        await el.play();
      } catch {
        // ignore (no file / policy)
      }
    };

    window.addEventListener('pointerdown', start, { once: true });
    window.addEventListener('keydown', start, { once: true });
    return () => {
      window.removeEventListener('pointerdown', start);
      window.removeEventListener('keydown', start);
    };
  }, [hoverEnabled]);

  const isAdmin = location.pathname === '/admin';

  // Check for ?admin=1 in URL (only check on mount/location change)
  const showAdminLink = new URLSearchParams(window.location.search).get('admin') === '1';

  return (
    <main
      className="relative bg-black overflow-hidden selection:bg-white selection:text-black"
      style={{
        position: 'relative',
        width: '100%',
        height: '100dvh',
        minHeight: '100vh',
        backgroundColor: '#000',
        overflow: 'hidden',
      }}
    >
      {/* Optional background music file at /public/ambient.mp3 or admin-set URL */}
      <audio ref={audioRef} src={musicUrl || MUSIC_PATH} preload="metadata" loop />

      {/* Intro & Logo Layer - Persistent (except Admin) */}
      {!isAdmin && (
        <LogoOverlay
          onIntroComplete={() => setIntroComplete(true)}
          hoverEnabled={hoverEnabled}
        />
      )}

      {/* Routes */}
      <Routes>
        <Route path="/" element={
          <GalleryRouteHandler
            settings={settings}
            introComplete={introComplete}
            images={images}
            onFirstCycleComplete={() => setFirstCycleComplete(true)}
          />
        } />
        <Route path="/:id" element={
          <GalleryRouteHandler
            settings={settings}
            introComplete={introComplete}
            images={images}
            onFirstCycleComplete={() => setFirstCycleComplete(true)}
          />
        } />

        {/* Admin */}
        <Route path="/admin" element={
          <Suspense fallback={null}>
            <div className="w-full h-full relative bg-black overflow-hidden">
              {/* Blurred gallery background for "projection" feel */}
              <div className="absolute inset-0 pointer-events-none">
              {images.length > 0 && (
                  <div className="absolute inset-0 blur-2xl brightness-50 scale-110">
                <Gallery
                  settings={settings}
                  images={images}
                  startRecord={images[0]}
                  nextRecord={images[1] || images[0]}
                  active={true}
                  onFirstCycleComplete={() => { }}
                />
                  </div>
              )}
                <div className="absolute inset-0 bg-black/50" />
              </div>

              <AdminPanel onUpdate={setSettings} />
            </div>
          </Suspense>
        } />
      </Routes>

      <ContactModal
        open={contactOpen}
        onClose={() => setContactOpen(false)}
        onSend={async (data) => {
          const { sendContact } = await import('./services/api');
          return await sendContact(data);
        }}
      />

      {/* Footer - Only visible after intro is complete, at bottom per client requirements */}
      {introComplete && !isAdmin && (
        <div
          className="fixed bottom-6 left-0 right-0 z-[60] flex justify-center pointer-events-none mix-blend-difference"
          // Inline fallback so the tiny Contact text is always bottom-center even if CSS/Tailwind fails
          style={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 24,
            zIndex: 60,
            display: 'flex',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          <button
            type="button"
            onClick={() => setContactOpen(true)}
            className="pointer-events-auto text-[10px] text-gray-500 uppercase tracking-widest hover:text-white transition-colors duration-300 opacity-50 hover:opacity-100"
            style={{
              pointerEvents: 'auto',
              fontSize: 10,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.35)',
              background: 'transparent',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              opacity: 0.55,
              transition: 'opacity 150ms ease, color 150ms ease',
            }}
          >
            Contact
          </button>

          {showAdminLink && (
            <a
              href="/admin"
              className="absolute right-6 pointer-events-auto text-[10px] text-gray-500 uppercase tracking-widest hover:text-white transition-colors duration-300 opacity-30 hover:opacity-100"
              style={{
                position: 'absolute',
                right: 24,
                pointerEvents: 'auto',
                fontSize: 10,
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.28)',
                textDecoration: 'none',
                background: 'transparent',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                opacity: 0.35,
                transition: 'opacity 150ms ease, color 150ms ease',
              }}
            >
              Admin
            </a>
          )}
        </div>
      )}
    </main>
  );
}