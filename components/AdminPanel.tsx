import React, { useState, useEffect, useRef } from 'react';
import { loginAdmin, fetchAdminSettings, updateAdminSettings, refreshAdminSync, deactivateAdminImage, fetchAdminImages, activateAdminImage, uploadAdminFiles, deleteAdminImage, uploadAdminMusic } from '../services/api';
import { AppSettings, AdminImageRecord } from '../types';

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
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'done' | 'error'>('idle');
  const [syncMessage, setSyncMessage] = useState('');
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

  const handleSave = async () => {
    setSaveStatus('saving');
    try {
      const success = await updateAdminSettings(settings);
      if (success) {
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
        // Propagate updates to live app immediately
        onUpdate({
          duration: settings.displayDurationSec,
          crop: settings.cropPercent / 100 // Convert 60 -> 0.6 for app type
        });
      } else {
        setSaveStatus('error');
      }
    } catch (e) {
      logout();
    }
  };

  const handleSyncNow = async () => {
    setSyncStatus('syncing');
    setSyncMessage('');
    try {
      const result = await refreshAdminSync();
      if (result.ok) {
        setSyncStatus('done');
        setSyncMessage(`Sync complete: +${result.newCount ?? 0} new, -${result.deactivatedCount ?? 0} deactivated, +${result.reactivatedCount ?? 0} reactivated`);
        setTimeout(() => setSyncStatus('idle'), 2500);
        setTimeout(() => loadImages(), 1500);
      } else {
        setSyncStatus('error');
        setSyncMessage(result.reason || 'Sync failed');
      }
    } catch (e: any) {
      if (e.message === 'Unauthorized') {
        logout();
        return;
      }
      setSyncStatus('error');
      setSyncMessage('Sync failed');
    }
  };

  const handleToggleActive = async (image: AdminImageRecord) => {
    const actionLabel = image.isActive ? 'Deactivate' : 'Activate';
    const confirmed = window.confirm(`${actionLabel} image ${image.id}?`);
    if (!confirmed) return;
    try {
      const result = image.isActive
        ? await deactivateAdminImage(image.id)
        : await activateAdminImage(image.id);
      if (result.ok) {
        setImages(prev => prev.map(img => img.id === image.id ? { ...img, isActive: !img.isActive } : img));
      } else {
        alert(result.message || `Failed to ${actionLabel.toLowerCase()} image.`);
      }
    } catch {
      logout();
    }
  };

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
  };

  const wrapStyle: React.CSSProperties = {
    width: '100%',
    maxWidth: 980,
    margin: '0 auto',
    padding: '48px 24px 72px',
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
                onChange={e => setSettings({ ...settings, displayDurationSec: Number(e.target.value) })}
                  className="fa-range"
                  style={{ marginTop: 12 }}
              />
            </div>

              {/* Crop */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={smallCapsStyle}>CROP / ZOOM</div>
                  <div style={valueStyle}>{settings.cropPercent}%</div>
                </div>
              <input
                type="range"
                min="25"
                max="100"
                step="1"
                value={settings.cropPercent}
                onChange={e => setSettings({ ...settings, cropPercent: Number(e.target.value) })}
                  className="fa-range"
                  style={{ marginTop: 12 }}
              />
            </div>

              {/* Save */}
              <div style={{ paddingTop: 8 }}>
              <button
                onClick={handleSave}
                  type="button"
                  style={{
                    width: '100%',
                    background: '#fff',
                    color: '#000',
                    padding: '18px 16px',
                    fontSize: 12,
                    fontWeight: 600,
                    letterSpacing: '0.35em',
                    textTransform: 'uppercase',
                    border: '1px solid rgba(255,255,255,0.25)',
                    cursor: 'pointer',
                  }}
                >
                  {saveStatus === 'saving' ? 'SAVING...' : 'SAVE CHANGES'}
                </button>
              </div>

              <div style={{ paddingTop: 10, ...lineStyle }} />

              {/* Content controls */}
              <div style={{ paddingTop: 22 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24 }}>
                  <div style={smallCapsStyle}>CONTENT CONTROLS</div>
                  <button onClick={loadImages} type="button" className="fa-hoverlink" style={linkStyle}>
                    REFRESH LIST
                  </button>
                </div>

                <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 340 }}>
                  <button
                    onClick={handleSyncNow}
                    type="button"
                    className="fa-btn"
                    style={buttonStyle}
                  >
                    {syncStatus === 'syncing' ? 'SYNCING...' : 'SYNC NOW'}
                  </button>

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
                  {syncMessage && (
                    <div style={{ fontSize: 10, letterSpacing: '0.25em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)' }}>
                      {syncMessage}
                    </div>
                  )}
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
                  IMAGES ({images.filter(i => i.isActive).length} ACTIVE / {images.length} TOTAL)
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
                          <div
                            key={img.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 16,
                              padding: 14,
                              borderTop: '1px solid rgba(255,255,255,0.10)',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
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
                                <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 12 }}>
                                  <span style={{ fontSize: 10, letterSpacing: '0.25em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.40)' }}>
                                    {img.mediaType}
                                  </span>
                                  <span style={{ fontSize: 10, letterSpacing: '0.25em', textTransform: 'uppercase', color: img.isActive ? 'rgba(134,239,172,0.95)' : 'rgba(252,165,165,0.95)' }}>
                                    {img.isActive ? 'ACTIVE' : 'INACTIVE'}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                              <a href={img.url} target="_blank" rel="noreferrer" className="fa-hoverlink" style={{ ...linkStyle, fontSize: 10 }}>
                                OPEN
                              </a>
                              <button
                                onClick={() => handleToggleActive(img)}
                                type="button"
                                className={img.isActive ? 'fa-danger' : 'fa-btn'}
                                style={img.isActive ? dangerButtonStyle : { ...buttonStyle, width: 'auto', maxWidth: 'unset', padding: '7px 10px', fontSize: 10 }}
                              >
                                {img.isActive ? 'DEACTIVATE' : 'ACTIVATE'}
                              </button>
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
