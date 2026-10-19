import React, { useState, useEffect, useRef } from 'react';
import { loginAdmin, fetchAdminSettings, updateAdminSettings, fetchAdminImages, uploadAdminFiles, deleteAdminImage, uploadAdminMusic } from '../services/api';
import { AppSettings, AdminImageRecord } from '../types';

const AUTOSAVE_DELAY_MS = 500;

interface AdminPanelProps {
  onUpdate: (settings: AppSettings) => void;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ onUpdate }) => {
  const [token, setToken] = useState(localStorage.getItem('admin_token'));
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Local state for sliders (mirroring backend structure)
  const [settings, setSettings] = useState({
    displayDurationSec: 6,
    cropPercent: 60
  });

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle');
  const [uploadMessage, setUploadMessage] = useState('');
  const [musicStatus, setMusicStatus] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle');
  const [musicMessage, setMusicMessage] = useState('');
  const [musicUrl, setMusicUrl] = useState<string | null>(null);
  const [images, setImages] = useState<AdminImageRecord[]>([]);
  const [imagesLoading, setImagesLoading] = useState(false);
  const [imagesError, setImagesError] = useState('');
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const musicInputRef = useRef<HTMLInputElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSave = useRef<typeof settings | null>(null);
  const saveSeq = useRef(0);

  // Check auth and fetch settings
  useEffect(() => {
    if (token) {
      loadSettings();
      loadImages();
    }
  }, [token]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const data = await fetchAdminSettings();
      if (data) {
        setSettings(data);
        if (typeof data.musicUrl === 'string') {
          setMusicUrl(data.musicUrl);
        } else {
          setMusicUrl(null);
        }
      }
    } catch (e) {
      // If unauthorized, logout
      logout();
    } finally {
      setLoading(false);
    }
  };

  const loadImages = async () => {
    setImagesError('');
    setImagesLoading(true);
    try {
      const data = await fetchAdminImages();
      setImages(data);
    } catch (e: any) {
      if (e.message === 'Unauthorized') {
        logout();
        return;
      }
      setImagesError('Failed to load images');
    } finally {
      setImagesLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const res = await loginAdmin(password);
    if (res && res.token) {
      localStorage.setItem('admin_token', res.token);
      setToken(res.token);
    } else {
      setError('Invalid password');
    }
    setLoading(false);
  };

  const logout = () => {
    localStorage.removeItem('admin_token');
    setToken(null);
    setPassword('');
  };

  const saveSettings = async (next: typeof settings) => {
    const seq = ++saveSeq.current;
    setSaveStatus('saving');
    try {
      const success = await updateAdminSettings(next);
      if (seq !== saveSeq.current) return; // a newer save superseded this one
      if (success) {
        setSaveStatus('saved');
        // Propagate updates to live app immediately
        onUpdate({
          duration: next.displayDurationSec,
          zoom: next.cropPercent / 100 // 0–100% → 0–1 (1 = zoom to 2x)
        });
      } else {
        setSaveStatus('error');
      }
    } catch (e) {
      logout();
    }
  };

  // Auto-save: wait until the slider settles, then save once
  const changeSetting = (patch: Partial<typeof settings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    setSaveStatus('saving');
    pendingSave.current = next;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null;
      pendingSave.current = null;
      void saveSettings(next);
    }, AUTOSAVE_DELAY_MS);
  };

  // Flush a pending save if the panel unmounts mid-debounce
  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (pendingSave.current) void updateAdminSettings(pendingSave.current).catch(() => {});
  }, []);

  const handleDelete = async (image: AdminImageRecord) => {
    const confirmed = window.confirm(`Permanently delete image ${image.id}? This will remove it from R2 and the database.`);
    if (!confirmed) return;
    try {
      const result = await deleteAdminImage(image.id);
      if (result.ok) {
        setImages(prev => prev.filter(img => img.id !== image.id));
      } else {
        alert(result.message || 'Delete failed.');
      }
    } catch {
      logout();
    }
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploadStatus('uploading');
    setUploadMessage('');
    try {
      const result = await uploadAdminFiles(Array.from(files));
      if (result.ok) {
        setUploadStatus('done');
        setUploadMessage(`Uploaded ${result.uploaded ?? 0}, skipped ${result.skipped ?? 0}`);
        setTimeout(() => setUploadStatus('idle'), 2500);
        setTimeout(() => loadImages(), 1500);
      } else {
        setUploadStatus('error');
        setUploadMessage(result.message || 'Upload failed');
      }
    } catch (e: any) {
      if (e.message === 'Unauthorized') {
        logout();
        return;
      }
      setUploadStatus('error');
      setUploadMessage('Upload failed');
    } finally {
      if (uploadInputRef.current) uploadInputRef.current.value = '';
    }
  };

  const handleMusicUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    setMusicStatus('uploading');
    setMusicMessage('');
    try {
      const result = await uploadAdminMusic(file);
      if (result.ok) {
        setMusicStatus('done');
        setMusicUrl(result.musicUrl || null);
        setMusicMessage('Music updated');
        setTimeout(() => setMusicStatus('idle'), 2500);
      } else {
        setMusicStatus('error');
        setMusicMessage(result.message || 'Upload failed');
      }
    } catch (e: any) {
      if (e.message === 'Unauthorized') {
        logout();
        return;
      }
      setMusicStatus('error');
      setMusicMessage('Upload failed');
    } finally {
      if (musicInputRef.current) musicInputRef.current.value = '';
    }
  };

  if (!token) {
    return (
      <div
        className="fixed inset-0 z-[100] bg-black text-white flex items-center justify-center p-6"
        // Inline fallbacks so the login always centers even if Tailwind/CSS is cached/missing
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          backgroundColor: 'rgba(0,0,0,0.85)',
          color: '#fff',
        }}
      >
        <div
          className="w-full max-w-md border border-white/10 bg-black/70 backdrop-blur-md rounded-xl p-6 sm:p-8"
          style={{
            width: '100%',
            maxWidth: 440,
            border: '1px solid rgba(255,255,255,0.12)',
            background: 'rgba(0,0,0,0.55)',
            WebkitBackdropFilter: 'blur(12px)',
            backdropFilter: 'blur(12px)',
            borderRadius: 16,
            padding: 24,
          }}
        >
          <div className="mb-6 text-center">
            <div className="text-[11px] uppercase tracking-[0.35em] text-white/70">Final Archive</div>
            <h1 className="mt-3 text-xl font-serif tracking-widest">Admin Access</h1>
          </div>

          <form onSubmit={handleLogin} className="flex flex-col gap-4">

          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Enter Password"
            className="bg-black border border-white/10 px-4 py-3 rounded-md text-center tracking-[0.25em] outline-none focus:border-white/40 transition-colors placeholder:text-white/20"
            style={{
              width: '100%',
              background: 'rgba(0,0,0,0.75)',
              border: '1px solid rgba(255,255,255,0.14)',
              borderRadius: 10,
              padding: '12px 16px',
              textAlign: 'center',
              color: '#fff',
              outline: 'none',
            }}
          />

          {error && <div className="text-red-400 text-xs text-center tracking-widest">{error}</div>}

          <button
            type="submit"
            disabled={loading}
            className="bg-white text-black py-3 rounded-md hover:bg-neutral-200 transition-colors tracking-[0.3em] text-sm font-bold uppercase disabled:opacity-50"
            style={{
              width: '100%',
              background: '#fff',
              color: '#000',
              borderRadius: 10,
              padding: '12px 16px',
              border: '1px solid rgba(255,255,255,0.2)',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              letterSpacing: '0.3em',
              textTransform: 'uppercase',
              fontWeight: 700,
            }}
          >
            {loading ? '...' : 'Login'}
          </button>
        </form>
        </div>
      </div>
    );
  }

  // Inline CSS fallback (admin dashboard) — avoids relying on Tailwind in production.
  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    zIndex: 100,
    color: '#fff',
    background: 'rgba(0,0,0,0.55)',
    WebkitBackdropFilter: 'blur(10px)',
    backdropFilter: 'blur(10px)',
    overflowY: 'auto',
    WebkitOverflowScrolling: 'touch',
  };

  const wrapStyle: React.CSSProperties = {
    width: '100%',
    maxWidth: 980,
    margin: '0 auto',
    padding: '32px 16px 72px',
  };

  const smallCapsStyle: React.CSSProperties = {
    fontSize: 11,
    letterSpacing: '0.25em',
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.62)',
  };

  const valueStyle: React.CSSProperties = {
    fontSize: 11,
    letterSpacing: '0.25em',
    color: 'rgba(255,255,255,0.78)',
  };

  const lineStyle: React.CSSProperties = {
    borderTop: '1px solid rgba(255,255,255,0.18)',
  };

  const linkStyle: React.CSSProperties = {
    fontSize: 10,
    letterSpacing: '0.25em',
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.55)',
    textDecoration: 'none',
    background: 'transparent',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
  };

  const buttonStyle: React.CSSProperties = {
    width: '100%',
    maxWidth: 320,
    border: '1px solid rgba(255,255,255,0.28)',
    background: 'transparent',
    color: 'rgba(255,255,255,0.86)',
    padding: '10px 14px',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.25em',
    textTransform: 'uppercase',
    cursor: 'pointer',
  };

  const dangerButtonStyle: React.CSSProperties = {
    border: '1px solid rgba(239,68,68,0.38)',
    background: 'transparent',
    color: 'rgba(252,165,165,0.95)',
    padding: '7px 10px',
    fontSize: 10,
    letterSpacing: '0.25em',
    textTransform: 'uppercase',
    cursor: 'pointer',
  };

  return (
    <div style={overlayStyle}>
      {/* Local CSS for range inputs (works even if global CSS fails) */}
      <style>{`
        .fa-range {
          -webkit-appearance: none;
          appearance: none;
          width: 100%;
          height: 2px;
          background: rgba(255,255,255,0.22);
          outline: none;
        }
        .fa-range::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 14px;
          height: 14px;
          border-radius: 999px;
          background: rgba(255,255,255,0.95);
          border: 1px solid rgba(0,0,0,0.35);
          cursor: pointer;
        }
        .fa-range::-moz-range-thumb {
          width: 14px;
          height: 14px;
          border-radius: 999px;
          background: rgba(255,255,255,0.95);
          border: 1px solid rgba(0,0,0,0.35);
          cursor: pointer;
        }
        .fa-hoverlink:hover { color: rgba(255,255,255,0.85) !important; }
        .fa-btn:hover { border-color: rgba(255,255,255,0.48) !important; color: rgba(255,255,255,0.96) !important; }
        .fa-danger:hover { border-color: rgba(239,68,68,0.65) !important; color: rgba(254,202,202,1) !important; }

        /* Image list rows: wrap actions below the info on narrow screens */
        .fa-row {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 12px 16px;
          padding: 14px;
          border-top: 1px solid rgba(255,255,255,0.10);
        }
        .fa-row-info {
          display: flex;
          align-items: center;
          gap: 14px;
          flex: 1 1 220px;
          min-width: 0;
        }
        .fa-row-actions {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-shrink: 0;
        }
        @media (max-width: 640px) {
          .fa-row-actions {
            width: 100%;
            justify-content: flex-end;
          }
        }
      `}</style>

      <div style={{ position: 'relative', width: '100%', height: '100%', overflowY: 'auto' }}>
        <div style={wrapStyle}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24 }}>
            <div style={{ fontFamily: 'Times New Roman, Times, serif', letterSpacing: '0.2em', fontSize: 34 }}>
              SETTINGS
            </div>
            <button onClick={logout} type="button" className="fa-hoverlink" style={linkStyle}>
              LOGOUT
          </button>
        </div>

          <div style={{ marginTop: 18, ...lineStyle }} />

        {loading ? (
            <div style={{ padding: '64px 0', textAlign: 'center', fontSize: 12, letterSpacing: '0.25em', color: 'rgba(255,255,255,0.55)' }}>
              LOADING...
            </div>
        ) : (
            <div style={{ paddingTop: 40, display: 'flex', flexDirection: 'column', gap: 34 }}>
              {/* Duration */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={smallCapsStyle}>DISPLAY DURATION</div>
                  <div style={valueStyle}>{settings.displayDurationSec}s</div>
              </div>
              <input
                type="range"
                min="1"
                max="10"
                step="1"
                value={settings.displayDurationSec}
                onChange={e => changeSetting({ displayDurationSec: Number(e.target.value) })}
                  className="fa-range"
                  style={{ marginTop: 12 }}
              />
            </div>

              {/* Crop / Zoom: 0% = no zoom, 100% = zooms to 2x */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={smallCapsStyle}>CROP / ZOOM</div>
                  <div style={valueStyle}>{settings.cropPercent}%</div>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={settings.cropPercent}
                onChange={e => changeSetting({ cropPercent: Number(e.target.value) })}
                  className="fa-range"
                  style={{ marginTop: 12 }}
              />
            </div>

              {/* Auto-save status */}
              <div
                aria-live="polite"
                style={{
                  minHeight: 14,
                  fontSize: 10,
                  letterSpacing: '0.25em',
                  textTransform: 'uppercase',
                  color: saveStatus === 'error' ? 'rgba(252,165,165,0.95)' : 'rgba(255,255,255,0.45)',
                }}
              >
                {saveStatus === 'saving' && 'SAVING...'}
                {saveStatus === 'saved' && 'SAVED'}
                {saveStatus === 'error' && "COULDN'T SAVE. MOVE THE SLIDER TO TRY AGAIN."}
              </div>

              <div style={{ paddingTop: 10, ...lineStyle }} />

              {/* Content controls */}
              <div style={{ paddingTop: 22 }}>
                <div style={smallCapsStyle}>CONTENT CONTROLS</div>

                <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 340 }}>
                  <input
                    ref={uploadInputRef}
                    type="file"
                    multiple
                    accept=".jpg,.jpeg,.png,.webp,.gif,.avif,.mp4,.webm,.mov"
                    className="hidden"
                    onChange={(e) => handleUpload(e.target.files)}
                  />
                  <button
                    onClick={() => uploadInputRef.current?.click()}
                    type="button"
                    className="fa-btn"
                    style={buttonStyle}
                  >
                    {uploadStatus === 'uploading' ? 'UPLOADING...' : 'UPLOAD FILES'}
                  </button>

                  <input
                    ref={musicInputRef}
                    type="file"
                    accept=".mp3,.m4a,.wav,.aac"
                    className="hidden"
                    onChange={(e) => handleMusicUpload(e.target.files)}
                  />
                  <button
                    onClick={() => musicInputRef.current?.click()}
                    type="button"
                    className="fa-btn"
                    style={buttonStyle}
                  >
                    {musicStatus === 'uploading' ? 'UPLOADING MUSIC...' : 'UPLOAD MUSIC'}
                  </button>

                  {/* Status lines */}
                  {uploadMessage && (
                    <div style={{ fontSize: 10, letterSpacing: '0.25em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)' }}>
                      {uploadMessage}
                    </div>
                  )}
                  {musicMessage && (
                    <div style={{ fontSize: 10, letterSpacing: '0.25em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)' }}>
                      {musicMessage}
                      {musicUrl ? ` • ${musicUrl}` : ''}
                    </div>
                  )}
                </div>
              </div>

              {/* Images */}
              <div style={{ paddingTop: 22 }}>
                <div style={{ ...smallCapsStyle, marginBottom: 12 }}>
                  IMAGES ({images.length})
                </div>

                {imagesLoading && (
                  <div style={{ padding: '40px 0', textAlign: 'center', fontSize: 12, letterSpacing: '0.25em', color: 'rgba(255,255,255,0.4)' }}>
                    LOADING IMAGES...
                  </div>
                )}
                {imagesError && (
                  <div style={{ padding: '24px 0', textAlign: 'center', fontSize: 12, letterSpacing: '0.25em', color: 'rgba(248,113,113,0.95)' }}>
                    {imagesError}
                  </div>
                )}

                {!imagesLoading && !imagesError && (
                  <div style={{ border: '1px solid rgba(255,255,255,0.18)' }}>
                    {images.length === 0 ? (
                      <div style={{ padding: 24, textAlign: 'center', fontSize: 12, letterSpacing: '0.25em', color: 'rgba(255,255,255,0.4)' }}>
                        NO IMAGES FOUND
                      </div>
                    ) : (
                      <div>
                        {images.map((img) => (
                          <div key={img.id} className="fa-row">
                            <div className="fa-row-info">
                              <div
                                style={{
                                  width: 64,
                                  height: 48,
                                  border: '1px solid rgba(255,255,255,0.16)',
                                  background: 'rgba(0,0,0,0.25)',
                                  overflow: 'hidden',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0,
                                }}
                              >
                                {img.mediaType === 'VIDEO' ? (
                                  <video src={img.url} className="w-full h-full object-cover" muted />
                                ) : (
                                  <img src={img.url} alt="" className="w-full h-full object-cover" />
                                )}
                              </div>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: 12, letterSpacing: '0.25em', color: 'rgba(255,255,255,0.86)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {img.id}
                                </div>
                                <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px 12px' }}>
                                  <span style={{ fontSize: 10, letterSpacing: '0.25em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.40)' }}>
                                    {img.mediaType}
                                  </span>
                                  {/* Only set automatically when the file was removed from storage */}
                                  {!img.isActive && (
                                    <span style={{ fontSize: 10, letterSpacing: '0.25em', textTransform: 'uppercase', color: 'rgba(252,165,165,0.95)' }}>
                                      MISSING FROM STORAGE
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="fa-row-actions">
                              <a href={img.url} target="_blank" rel="noreferrer" className="fa-hoverlink" style={{ ...linkStyle, fontSize: 10 }}>
                                OPEN
                              </a>
                              <button onClick={() => handleDelete(img)} className="fa-danger" style={dangerButtonStyle} type="button">
                                DELETE
              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
