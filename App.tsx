import React, { useState, useEffect, Suspense } from 'react';
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

      // 2. Resolve Next Image
      const nextRecord = pickRandom(images, startRecord.id);

      // 3. Preload BOTH images into browser cache
      // This ensures that when Intro finishes, Step 7 is instant (from cache)
      try {
        await Promise.all([
          preloadMedia(startRecord.url),
          preloadMedia(nextRecord.url)
        ]);
      } catch (e) {
        console.warn('Preload warning', e);
      }

      if (!isCancelled) {
        setReadyData({ start: startRecord, next: nextRecord });
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
      images={images}
      startRecord={readyData.start}
      nextRecord={readyData.next}
      active={introComplete}
      onFirstCycleComplete={onFirstCycleComplete}
    />
  );
};

export default function App() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [introComplete, setIntroComplete] = useState(false);
  const [hoverEnabled, setHoverEnabled] = useState(false);
  const [images, setImages] = useState<ImageRecord[]>([]);
  const [contactOpen, setContactOpen] = useState(false);
  const location = useLocation();
  const audioRef = React.useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Sync public settings from backend
    import('./services/api').then(({ fetchPublicSettings }) => {
      fetchPublicSettings().then(s => {
        if (s) setSettings({
          duration: s.displayDurationSec,
          crop: s.cropPercent / 100
        });
      });
    });

    // Performance Requirement:
    // Fetch immediately on mount. Do NOT wait for idle callback.
    fetchImageList().then(data => setImages(data));
  }, []);

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
    <main className="relative w-screen h-screen bg-black overflow-hidden selection:bg-white selection:text-black">
      {/* Optional background music file at /public/ambient.mp3 */}
      <audio ref={audioRef} src={MUSIC_PATH} preload="metadata" loop />

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
            onFirstCycleComplete={() => setHoverEnabled(true)}
          />
        } />
        <Route path="/:id" element={
          <GalleryRouteHandler
            settings={settings}
            introComplete={introComplete}
            images={images}
            onFirstCycleComplete={() => setHoverEnabled(true)}
          />
        } />

        {/* Admin */}
        <Route path="/admin" element={
          <Suspense fallback={null}>
            <div className="w-full h-full relative">
              {/* Dummy Gallery for Admin BG */}
              {images.length > 0 && (
                <Gallery
                  settings={settings}
                  images={images}
                  startRecord={images[0]}
                  nextRecord={images[1] || images[0]}
                  active={true}
                  onFirstCycleComplete={() => { }}
                />
              )}
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

      {/* Footer - Only visible after intro is complete */}
      {introComplete && (
        <div className="fixed bottom-6 left-0 right-0 z-[60] flex justify-center pointer-events-none mix-blend-difference">
          <button
            type="button"
            onClick={() => setContactOpen(true)}
            className="pointer-events-auto text-[10px] text-gray-500 uppercase tracking-widest hover:text-white transition-colors duration-300 opacity-50 hover:opacity-100"
          >
            Contact
          </button>

          {showAdminLink && (
            <a
              href="/admin"
              className="absolute right-6 pointer-events-auto text-[10px] text-gray-500 uppercase tracking-widest hover:text-white transition-colors duration-300 opacity-30 hover:opacity-100"
            >
              Admin
            </a>
          )}
        </div>
      )}
    </main>
  );
}