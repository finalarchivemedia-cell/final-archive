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

  const smallCaps = 'uppercase tracking-[0.25em] text-[11px] text-white/60';
  const thinLine = 'border-t border-white/15';
  const btn = 'border border-white/25 text-white/85 hover:text-white hover:border-white/45 transition-colors px-4 py-2 text-[11px] font-bold tracking-[0.25em] uppercase';
  const btnDanger = 'border border-red-500/35 text-red-300/90 hover:text-red-200 hover:border-red-500/55 transition-colors px-3 py-1.5 text-[10px] tracking-[0.25em] uppercase';
  const btnLink = 'text-[10px] text-white/45 hover:text-white/80 transition-colors tracking-[0.25em] uppercase';

  return (
    <div className="fixed inset-0 z-[100] text-white">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />

      <div className="relative h-full w-full overflow-y-auto">
        <div className="mx-auto w-full max-w-4xl px-6 sm:px-8 py-12">
          <div className="flex items-start justify-between gap-6">
            <div>
              <div className="text-3xl sm:text-4xl font-serif tracking-[0.2em]">SETTINGS</div>
            </div>
            <button onClick={logout} className={btnLink} type="button">
              LOGOUT
          </button>
        </div>

          <div className={`mt-6 ${thinLine}`} />

        {loading ? (
            <div className="py-16 text-center text-xs tracking-widest text-white/50 animate-pulse">LOADING...</div>
        ) : (
            <div className="space-y-10 pt-10">
              {/* Duration */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className={smallCaps}>DISPLAY DURATION</div>
                  <div className="text-[11px] tracking-[0.25em] text-white/80">{settings.displayDurationSec}s</div>
              </div>
              <input
                type="range"
                min="1"
                max="10"
                step="1"
                value={settings.displayDurationSec}
                onChange={e => setSettings({ ...settings, displayDurationSec: Number(e.target.value) })}
                  className="w-full h-[2px] bg-white/20 rounded-lg appearance-none cursor-pointer accent-white"
              />
            </div>

              {/* Crop */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className={smallCaps}>CROP / ZOOM</div>
                  <div className="text-[11px] tracking-[0.25em] text-white/80">{settings.cropPercent}%</div>
              </div>
              <input
                type="range"
                min="25"
                max="100"
                step="1"
                value={settings.cropPercent}
                onChange={e => setSettings({ ...settings, cropPercent: Number(e.target.value) })}
                  className="w-full h-[2px] bg-white/20 rounded-lg appearance-none cursor-pointer accent-white"
              />
            </div>

              {/* Save */}
              <div className="pt-4">
              <button
                onClick={handleSave}
                  type="button"
                  className="w-full bg-white text-black py-5 text-[12px] font-semibold tracking-[0.35em] uppercase hover:bg-white/90 transition-colors"
                >
                  {saveStatus === 'saving' ? 'SAVING...' : 'SAVE CHANGES'}
                </button>
              </div>

              <div className={`pt-2 ${thinLine}`} />

              {/* Content controls */}
              <div className="pt-6">
                <div className="flex items-start justify-between gap-6">
                  <div className={smallCaps}>CONTENT CONTROLS</div>
                  <button onClick={loadImages} type="button" className={btnLink}>
                    REFRESH LIST
                  </button>
                </div>

                <div className="mt-4 flex flex-col gap-3 w-full max-w-xs">
                  <button
                    onClick={handleSyncNow}
                    className={btn}
                    type="button"
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
                    className={btn}
                    type="button"
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
                    className={btn}
                    type="button"
                  >
                    {musicStatus === 'uploading' ? 'UPLOADING MUSIC...' : 'UPLOAD MUSIC'}
                  </button>

                  {/* Status lines */}
                  {syncMessage && (
                    <div className="text-[10px] tracking-[0.25em] uppercase text-white/45">{syncMessage}</div>
                  )}
                  {uploadMessage && (
                    <div className="text-[10px] tracking-[0.25em] uppercase text-white/45">{uploadMessage}</div>
                  )}
                  {musicMessage && (
                    <div className="text-[10px] tracking-[0.25em] uppercase text-white/45">
                      {musicMessage}
                      {musicUrl ? ` • ${musicUrl}` : ''}
                    </div>
                  )}
                </div>
              </div>

              {/* Images */}
              <div className="pt-6">
                <div className={`${smallCaps} mb-3`}>
                  IMAGES ({images.filter(i => i.isActive).length} ACTIVE / {images.length} TOTAL)
                </div>

                {imagesLoading && (
                  <div className="py-10 text-center text-xs tracking-widest text-white/40 animate-pulse">LOADING IMAGES...</div>
                )}
                {imagesError && (
                  <div className="py-6 text-center text-xs tracking-widest text-red-400">{imagesError}</div>
                )}

                {!imagesLoading && !imagesError && (
                  <div className="border border-white/15">
                    {images.length === 0 ? (
                      <div className="p-6 text-center text-xs tracking-widest text-white/40">NO IMAGES FOUND</div>
                    ) : (
                      <div className="divide-y divide-white/10">
                        {images.map((img) => (
                          <div key={img.id} className="flex items-center justify-between gap-4 p-4">
                            <div className="flex items-center gap-4 min-w-0">
                              <div className="w-16 h-12 border border-white/15 bg-black/30 overflow-hidden flex items-center justify-center shrink-0">
                                {img.mediaType === 'VIDEO' ? (
                                  <video src={img.url} className="w-full h-full object-cover" muted />
                                ) : (
                                  <img src={img.url} alt="" className="w-full h-full object-cover" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <div className="text-[12px] tracking-[0.25em] text-white/85 truncate">{img.id}</div>
                                <div className="mt-1 flex items-center gap-3">
                                  <span className="text-[10px] tracking-[0.25em] uppercase text-white/40">{img.mediaType}</span>
                                  <span className={`text-[10px] tracking-[0.25em] uppercase ${img.isActive ? 'text-green-300' : 'text-red-300'}`}>
                                    {img.isActive ? 'ACTIVE' : 'INACTIVE'}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                              <a href={img.url} target="_blank" rel="noreferrer" className={btnLink}>
                                OPEN
                              </a>
                              <button
                                onClick={() => handleToggleActive(img)}
                                className={img.isActive ? btnDanger : btn}
                                type="button"
                              >
                                {img.isActive ? 'DEACTIVATE' : 'ACTIVATE'}
                              </button>
                              <button onClick={() => handleDelete(img)} className={btnDanger} type="button">
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
