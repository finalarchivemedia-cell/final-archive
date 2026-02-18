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
      <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm text-white p-4">
        <form onSubmit={handleLogin} className="w-full max-w-sm flex flex-col gap-4">
          <h1 className="text-xl font-serif tracking-widest text-center mb-8">ADMIN ACCESS</h1>

          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Enter Password"
            className="bg-neutral-900 border border-neutral-800 p-3 text-center tracking-widest outline-none focus:border-white transition-colors placeholder:text-neutral-700"
          />

          {error && <div className="text-red-500 text-xs text-center tracking-widest">{error}</div>}

          <button
            type="submit"
            disabled={loading}
            className="bg-white text-black py-3 hover:bg-neutral-200 transition-colors tracking-widest text-sm font-bold uppercase disabled:opacity-50"
          >
            {loading ? '...' : 'Login'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 bg-black/95 backdrop-blur-sm z-[100] text-white flex flex-col items-center justify-center p-8 overflow-y-auto">
      <div className="w-full max-w-3xl space-y-12 my-auto">
        <div className="flex justify-between items-end border-b border-white/20 pb-4">
          <h1 className="text-2xl font-serif tracking-widest">SETTINGS</h1>
          <button onClick={logout} className="text-xs text-neutral-500 hover:text-white transition-colors tracking-widest uppercase">
            Logout
          </button>
        </div>

        {loading ? (
          <div className="text-center animate-pulse tracking-widest text-xs">LOADING...</div>
        ) : (
          <div className="space-y-10">
            {/* Duration Slider */}
            <div className="space-y-4">
              <div className="flex justify-between text-xs tracking-widest uppercase text-neutral-400">
                <label>Display Duration</label>
                <span className="text-white">{settings.displayDurationSec}s</span>
              </div>
              <input
                type="range"
                min="1"
                max="10"
                step="1"
                value={settings.displayDurationSec}
                onChange={e => setSettings({ ...settings, displayDurationSec: Number(e.target.value) })}
                className="w-full h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-white"
              />
            </div>

            {/* Crop Slider */}
            <div className="space-y-4">
              <div className="flex justify-between text-xs tracking-widest uppercase text-neutral-400">
                <label>Crop / Zoom</label>
                <span className="text-white">{settings.cropPercent}%</span>
              </div>
              <input
                type="range"
                min="25"
                max="100"
                step="1"
                value={settings.cropPercent}
                onChange={e => setSettings({ ...settings, cropPercent: Number(e.target.value) })}
                className="w-full h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-white"
              />
            </div>

            <div className="pt-6">
              <button
                onClick={handleSave}
                className={`w-full py-4 text-sm font-bold tracking-[0.2em] uppercase transition-all duration-300 border ${saveStatus === 'saved'
                  ? 'bg-green-900 border-green-700 text-green-100'
                  : 'bg-white text-black border-white hover:bg-neutral-200'
                  }`}
              >
                {saveStatus === 'saving' ? 'SAVING...' : saveStatus === 'saved' ? 'SAVED' : 'SAVE CHANGES'}
              </button>
            </div>

            {/* Content Controls */}
            <div className="pt-4 border-t border-white/10">
              <div className="flex items-center justify-between text-xs tracking-widest uppercase text-neutral-400 mb-4">
                <span>Content Controls</span>
                <button
                  onClick={loadImages}
                  className="text-[10px] text-neutral-500 hover:text-white transition-colors uppercase tracking-widest"
                  type="button"
                >
                  Refresh List
                </button>
              </div>

              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-4">
                <button
                  onClick={handleSyncNow}
                  className={`px-4 py-2 text-xs font-bold tracking-widest uppercase transition-all duration-300 border ${
                    syncStatus === 'done'
                      ? 'bg-green-900 border-green-700 text-green-100'
                      : 'bg-transparent text-white border-white/30 hover:border-white'
                  }`}
                  type="button"
                >
                  {syncStatus === 'syncing' ? 'SYNCING...' : syncStatus === 'done' ? 'SYNC STARTED' : 'SYNC NOW'}
                </button>
                  {syncStatus === 'error' && (
                    <span className="text-[10px] text-red-400 tracking-widest uppercase">{syncMessage || 'SYNC FAILED'}</span>
                  )}
                </div>
                {syncMessage && syncStatus !== 'error' && (
                  <div className="text-[10px] text-neutral-400 tracking-widest uppercase">{syncMessage}</div>
                )}
                <div className="flex items-center gap-4">
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
                    className={`px-4 py-2 text-xs font-bold tracking-widest uppercase transition-all duration-300 border ${
                      uploadStatus === 'done'
                        ? 'bg-green-900 border-green-700 text-green-100'
                        : 'bg-transparent text-white border-white/30 hover:border-white'
                    }`}
                    type="button"
                  >
                    {uploadStatus === 'uploading' ? 'UPLOADING...' : uploadStatus === 'done' ? 'UPLOADED' : 'UPLOAD FILES'}
                  </button>
                  {uploadStatus === 'error' && (
                    <span className="text-[10px] text-red-400 tracking-widest uppercase">{uploadMessage || 'UPLOAD FAILED'}</span>
                  )}
                </div>
                {uploadMessage && uploadStatus !== 'error' && (
                  <div className="text-[10px] text-neutral-400 tracking-widest uppercase">{uploadMessage}</div>
                )}
                <div className="flex items-center gap-4">
                  <input
                    ref={musicInputRef}
                    type="file"
                    accept=".mp3,.m4a,.wav,.aac"
                    className="hidden"
                    onChange={(e) => handleMusicUpload(e.target.files)}
                  />
                  <button
                    onClick={() => musicInputRef.current?.click()}
                    className={`px-4 py-2 text-xs font-bold tracking-widest uppercase transition-all duration-300 border ${
                      musicStatus === 'done'
                        ? 'bg-green-900 border-green-700 text-green-100'
                        : 'bg-transparent text-white border-white/30 hover:border-white'
                    }`}
                    type="button"
                  >
                    {musicStatus === 'uploading' ? 'UPLOADING MUSIC...' : musicStatus === 'done' ? 'MUSIC UPDATED' : 'UPLOAD MUSIC'}
                  </button>
                  {musicStatus === 'error' && (
                    <span className="text-[10px] text-red-400 tracking-widest uppercase">{musicMessage || 'UPLOAD FAILED'}</span>
                  )}
                </div>
                {musicMessage && musicStatus !== 'error' && (
                  <div className="text-[10px] text-neutral-400 tracking-widest uppercase">
                    {musicMessage}
                    {musicUrl ? ` • ${musicUrl}` : ''}
                  </div>
                )}
              </div>

              <div className="mt-6">
                <div className="text-xs tracking-widest uppercase text-neutral-400 mb-3">
                  Images ({images.filter(img => img.isActive).length} active / {images.length} total)
                </div>

                {imagesLoading && (
                  <div className="text-center animate-pulse tracking-widest text-xs text-neutral-400">LOADING IMAGES...</div>
                )}
                {imagesError && (
                  <div className="text-center tracking-widest text-xs text-red-500">{imagesError}</div>
                )}

                {!imagesLoading && !imagesError && (
                  <div className="max-h-[40vh] overflow-y-auto border border-white/10 rounded-sm">
                    {images.length === 0 ? (
                      <div className="p-4 text-center text-xs tracking-widest text-neutral-500">NO IMAGES FOUND</div>
                    ) : (
                      <div className="divide-y divide-white/10">
                        {images.map((img) => (
                          <div key={img.id} className="flex items-center gap-4 p-3">
                            <div className="w-16 h-12 bg-black/60 border border-white/10 flex items-center justify-center">
                              {img.mediaType === 'VIDEO' ? (
                                <video src={img.url} className="w-full h-full object-cover" muted />
                              ) : (
                                <img src={img.url} alt="" className="w-full h-full object-cover" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs tracking-widest">{img.id}</div>
                              <div className="text-[10px] text-neutral-500 tracking-widest uppercase">{img.mediaType}</div>
                              <div className={`text-[10px] tracking-widest uppercase ${img.isActive ? 'text-green-400' : 'text-red-400'}`}>
                                {img.isActive ? 'Active' : 'Inactive'}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <a
                                href={img.url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[10px] text-neutral-500 hover:text-white transition-colors tracking-widest uppercase"
                              >
                                Open
                              </a>
                              <button
                                onClick={() => handleToggleActive(img)}
                                className={`text-[10px] transition-colors tracking-widest uppercase ${
                                  img.isActive ? 'text-red-400 hover:text-red-300' : 'text-green-400 hover:text-green-300'
                                }`}
                                type="button"
                              >
                                {img.isActive ? 'Deactivate' : 'Activate'}
                              </button>
                              <button
                                onClick={() => handleDelete(img)}
                                className="text-[10px] text-red-500 hover:text-red-400 transition-colors tracking-widest uppercase"
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
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPanel;
