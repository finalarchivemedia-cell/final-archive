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
      <div className="fixed inset-0 z-[100] bg-black text-white flex items-center justify-center p-6">
        <div className="w-full max-w-md border border-white/10 bg-black/70 backdrop-blur-md rounded-xl p-6 sm:p-8">
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
          />

          {error && <div className="text-red-400 text-xs text-center tracking-widest">{error}</div>}

          <button
            type="submit"
            disabled={loading}
            className="bg-white text-black py-3 rounded-md hover:bg-neutral-200 transition-colors tracking-[0.3em] text-sm font-bold uppercase disabled:opacity-50"
          >
            {loading ? '...' : 'Login'}
          </button>
          </form>
        </div>
      </div>
    );
  }

  const card = 'border border-white/10 bg-white/5 rounded-xl';
  const label = 'text-[11px] uppercase tracking-[0.25em] text-white/60';
  const buttonBase = 'px-4 py-2 text-[11px] font-bold tracking-[0.25em] uppercase transition-colors border rounded-md';

  return (
    <div className="fixed inset-0 z-[100] bg-black text-white">
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-white/5 via-transparent to-transparent" />

      <div className="relative h-full w-full flex flex-col">
        <header className="flex items-center justify-between px-5 sm:px-8 py-5 border-b border-white/10">
          <div>
            <div className="text-[10px] uppercase tracking-[0.35em] text-white/60">Private Panel</div>
            <div className="mt-1 text-xl font-serif tracking-widest">Final Archive</div>
          </div>
          <button
            onClick={logout}
            className="text-[10px] text-white/50 hover:text-white/80 transition-colors tracking-[0.25em] uppercase"
            type="button"
          >
            Logout
          </button>
        </header>

        {loading ? (
          <div className="flex-1 flex items-center justify-center text-xs tracking-widest text-white/50 animate-pulse">
            LOADING...
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-5 sm:px-8 py-6 pb-10">
            <div className="mx-auto w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left column */}
              <div className="space-y-6">
                <section className={`${card} p-5 sm:p-6`}>
                  <div className={`${label} mb-5`}>Playback</div>

                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <label className={label}>Display Duration</label>
                      <span className="text-white/90 text-[11px] tracking-[0.25em]">{settings.displayDurationSec}s</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="10"
                      step="1"
                      value={settings.displayDurationSec}
                      onChange={e => setSettings({ ...settings, displayDurationSec: Number(e.target.value) })}
                      className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-white"
                    />
                  </div>

                  <div className="space-y-4 pt-4">
                    <div className="flex justify-between items-center">
                      <label className={label}>Crop / Zoom</label>
                      <span className="text-white/90 text-[11px] tracking-[0.25em]">{settings.cropPercent}%</span>
                    </div>
                    <input
                      type="range"
                      min="25"
                      max="100"
                      step="1"
                      value={settings.cropPercent}
                      onChange={e => setSettings({ ...settings, cropPercent: Number(e.target.value) })}
                      className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-white"
                    />
                  </div>

                  <div className="pt-6">
                    <button
                      onClick={handleSave}
                      type="button"
                      className={
                        saveStatus === 'saved'
                          ? `${buttonBase} w-full bg-green-900/40 border-green-700/60 text-green-100`
                          : `${buttonBase} w-full bg-white text-black border-white hover:bg-neutral-200`
                      }
                    >
                      {saveStatus === 'saving' ? 'SAVING...' : saveStatus === 'saved' ? 'SAVED' : 'SAVE CHANGES'}
                    </button>
                  </div>
                </section>

                <section className={`${card} p-5 sm:p-6`}>
                  <div className="flex items-center justify-between mb-5">
                    <div className={label}>Content</div>
                    <button
                      onClick={loadImages}
                      className="text-[10px] text-white/40 hover:text-white/70 transition-colors uppercase tracking-[0.25em]"
                      type="button"
                    >
                      Refresh
                    </button>
                  </div>

                  <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        onClick={handleSyncNow}
                        className={
                          syncStatus === 'done'
                            ? `${buttonBase} bg-green-900/40 border-green-700/60 text-green-100`
                            : `${buttonBase} bg-transparent text-white border-white/20 hover:border-white/40`
                        }
                        type="button"
                      >
                        {syncStatus === 'syncing' ? 'SYNCING...' : syncStatus === 'done' ? 'SYNC STARTED' : 'SYNC NOW'}
                      </button>
                      {syncStatus === 'error' && (
                        <span className="text-[10px] text-red-400 tracking-[0.25em] uppercase">{syncMessage || 'SYNC FAILED'}</span>
                      )}
                    </div>
                    {syncMessage && syncStatus !== 'error' && (
                      <div className="text-[10px] text-white/40 tracking-[0.25em] uppercase">{syncMessage}</div>
                    )}

                    <div className="flex flex-wrap items-center gap-3">
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
                        className={
                          uploadStatus === 'done'
                            ? `${buttonBase} bg-green-900/40 border-green-700/60 text-green-100`
                            : `${buttonBase} bg-transparent text-white border-white/20 hover:border-white/40`
                        }
                        type="button"
                      >
                        {uploadStatus === 'uploading' ? 'UPLOADING...' : uploadStatus === 'done' ? 'UPLOADED' : 'UPLOAD FILES'}
                      </button>
                      {uploadStatus === 'error' && (
                        <span className="text-[10px] text-red-400 tracking-[0.25em] uppercase">{uploadMessage || 'UPLOAD FAILED'}</span>
                      )}
                    </div>
                    {uploadMessage && uploadStatus !== 'error' && (
                      <div className="text-[10px] text-white/40 tracking-[0.25em] uppercase">{uploadMessage}</div>
                    )}

                    <div className="flex flex-wrap items-center gap-3">
                      <input
                        ref={musicInputRef}
                        type="file"
                        accept=".mp3,.m4a,.wav,.aac"
                        className="hidden"
                        onChange={(e) => handleMusicUpload(e.target.files)}
                      />
                      <button
                        onClick={() => musicInputRef.current?.click()}
                        className={
                          musicStatus === 'done'
                            ? `${buttonBase} bg-green-900/40 border-green-700/60 text-green-100`
                            : `${buttonBase} bg-transparent text-white border-white/20 hover:border-white/40`
                        }
                        type="button"
                      >
                        {musicStatus === 'uploading' ? 'UPLOADING MUSIC...' : musicStatus === 'done' ? 'MUSIC UPDATED' : 'UPLOAD MUSIC'}
                      </button>
                      {musicStatus === 'error' && (
                        <span className="text-[10px] text-red-400 tracking-[0.25em] uppercase">{musicMessage || 'UPLOAD FAILED'}</span>
                      )}
                    </div>
                    {musicMessage && musicStatus !== 'error' && (
                      <div className="text-[10px] text-white/40 tracking-[0.25em] uppercase">
                        {musicMessage}
                        {musicUrl ? ` • ${musicUrl}` : ''}
                      </div>
                    )}
                  </div>
                </section>
              </div>

              {/* Right column */}
              <section className={`${card} p-5 sm:p-6`}>
                <div className="flex items-center justify-between mb-5">
                  <div className={label}>
                    Library ({images.filter(img => img.isActive).length} active / {images.length})
                  </div>
                  <div className="text-[10px] text-white/40 tracking-[0.25em] uppercase">IDs are permanent</div>
                </div>

                {imagesLoading && (
                  <div className="text-center animate-pulse tracking-widest text-xs text-white/40">LOADING IMAGES...</div>
                )}
                {imagesError && (
                  <div className="text-center tracking-widest text-xs text-red-400">{imagesError}</div>
                )}

                {!imagesLoading && !imagesError && (
                  <div className="max-h-[65vh] overflow-y-auto border border-white/10 rounded-md">
                    {images.length === 0 ? (
                      <div className="p-6 text-center text-xs tracking-widest text-white/30">NO IMAGES FOUND</div>
                    ) : (
                      <div className="divide-y divide-white/10">
                        {images.map((img) => (
                          <div key={img.id} className="flex items-center gap-4 p-3">
                            <div className="w-20 h-14 bg-black/60 border border-white/10 rounded-sm overflow-hidden flex items-center justify-center">
                              {img.mediaType === 'VIDEO' ? (
                                <video src={img.url} className="w-full h-full object-cover" muted />
                              ) : (
                                <img src={img.url} alt="" className="w-full h-full object-cover" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-[12px] tracking-[0.25em]">{img.id}</div>
                              <div className="mt-1 flex items-center gap-2">
                                <span className="text-[10px] text-white/40 tracking-[0.25em] uppercase">{img.mediaType}</span>
                                <span
                                  className={
                                    img.isActive
                                      ? 'text-[10px] tracking-[0.25em] uppercase px-2 py-[2px] rounded-full border text-green-200 border-green-700/60 bg-green-900/30'
                                      : 'text-[10px] tracking-[0.25em] uppercase px-2 py-[2px] rounded-full border text-red-200 border-red-700/60 bg-red-900/30'
                                  }
                                >
                                  {img.isActive ? 'ACTIVE' : 'INACTIVE'}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <a
                                href={img.url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[10px] text-white/40 hover:text-white/70 transition-colors tracking-[0.25em] uppercase"
                              >
                                Open
                              </a>
                              <button
                                onClick={() => handleToggleActive(img)}
                                className={
                                  img.isActive
                                    ? 'text-[10px] transition-colors tracking-[0.25em] uppercase text-red-300 hover:text-red-200'
                                    : 'text-[10px] transition-colors tracking-[0.25em] uppercase text-green-300 hover:text-green-200'
                                }
                                type="button"
                              >
                                {img.isActive ? 'Deactivate' : 'Activate'}
                              </button>
                              <button
                                onClick={() => handleDelete(img)}
                                className="text-[10px] text-red-400 hover:text-red-300 transition-colors tracking-[0.25em] uppercase"
                                type="button"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </section>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPanel;
