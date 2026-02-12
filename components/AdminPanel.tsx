import React, { useState, useEffect } from 'react';
import { fetchImageList, loginAdmin, fetchAdminSettings, updateAdminSettings, refreshAdminSync, deactivateAdminImage } from '../services/api';
import { AppSettings, ImageRecord } from '../types';

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
  const [images, setImages] = useState<ImageRecord[]>([]);
  const [imagesLoading, setImagesLoading] = useState(false);
  const [imagesError, setImagesError] = useState('');

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
      const data = await fetchImageList();
      setImages(data);
    } catch {
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
    try {
      const success = await refreshAdminSync();
      if (success) {
        setSyncStatus('done');
        setTimeout(() => setSyncStatus('idle'), 2000);
        setTimeout(() => loadImages(), 1500);
      } else {
        setSyncStatus('error');
      }
    } catch {
      logout();
    }
  };

  const handleDeactivate = async (id: string) => {
    const confirmed = window.confirm(`Deactivate image ${id}? This will hide it from the website.`);
    if (!confirmed) return;
    try {
      const success = await deactivateAdminImage(id);
      if (success) {
        setImages(prev => prev.filter(img => img.id !== id));
      } else {
        alert('Failed to deactivate image.');
      }
    } catch {
      logout();
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
    <div className="absolute inset-0 bg-black/95 backdrop-blur-sm z-[100] text-white flex flex-col items-center justify-center p-8">
      <div className="w-full max-w-3xl space-y-12">
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

              <div className="flex gap-4">
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
              </div>

              <div className="mt-6">
                <div className="text-xs tracking-widest uppercase text-neutral-400 mb-3">
                  Active Images ({images.length})
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
                                onClick={() => handleDeactivate(img.id)}
                                className="text-[10px] text-red-400 hover:text-red-300 transition-colors tracking-widest uppercase"
                                type="button"
                              >
                                Deactivate
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
