import React, { useState, useEffect } from 'react';
import { loginAdmin, fetchAdminSettings, updateAdminSettings } from '../services/api';
import { AppSettings } from '../types';

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

  // Check auth and fetch settings
  useEffect(() => {
    if (token) {
      loadSettings();
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
      <div className="w-full max-w-md space-y-12">
        <div className="flex justify-between items-end border-b border-white/20 pb-4">
          <h1 className="text-2xl font-serif tracking-widest">SETTINGS</h1>
          <button onClick={logout} className="text-xs text-neutral-500 hover:text-white transition-colors tracking-widest uppercase">
            Logout
          </button>
        </div>

        {loading ? (
          <div className="text-center animate-pulse tracking-widest text-xs">LOADING...</div>
        ) : (
          <div className="space-y-8">
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

            <div className="pt-8">
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
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPanel;
