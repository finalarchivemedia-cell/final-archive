import { AppSettings, ImageRecord, AdminImageRecord } from '../types';

// Get API base URL from environment or use relative path as fallback
const getApiOrigin = () => {
  const envUrl = (import.meta as any).env?.VITE_API_BASE_URL;
  if (envUrl) return envUrl;
  
  // Fallback: Try to detect if we're in production
  // If on finalarchivemedia.com, use Railway backend
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (hostname === 'finalarchivemedia.com' || hostname === 'www.finalarchivemedia.com') {
      return 'https://final-archive-production.up.railway.app';
    }
  }
  
  return ''; // Relative path for local dev
};

const API_ORIGIN = getApiOrigin();
const API_BASE = `${API_ORIGIN}/api`;

// --- Public Endpoints ---

export const fetchImageList = async (): Promise<ImageRecord[]> => {
  try {
    const url = `${API_BASE}/images`;
    console.log('[API] Fetching images from:', url);
    const res = await fetch(url);
    if (!res.ok) {
      console.error('[API] Failed to fetch images:', res.status, res.statusText);
      throw new Error(`Failed to fetch images: ${res.status} ${res.statusText}`);
    }
    const data = await res.json();
    console.log('[API] Fetched images:', data.length);
    return data;
  } catch (err) {
    console.error('[API] Error fetching images:', err);
    return [];
  }
};

export const fetchImageById = async (id: string): Promise<ImageRecord | null> => {
  try {
    const res = await fetch(`${API_BASE}/images/${id}`);
    if (res.status === 404 || res.status === 410) return null;
    if (!res.ok) throw new Error('Failed to fetch image');
    return await res.json();
  } catch (err) {
    console.warn(err);
    return null;
  }
};

export const fetchPublicSettings = async (): Promise<{ displayDurationSec: number; cropPercent: number; musicUrl?: string | null } | null> => {
  try {
    const res = await fetch(`${API_BASE}/settings`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
};


// --- Admin Endpoints ---

const getAuthHeaders = (includeJson = true) => {
  const token = localStorage.getItem('admin_token');
  return {
    ...(includeJson ? { 'Content-Type': 'application/json' } : {}),
    'Authorization': `Bearer ${token}`
  };
};

export const loginAdmin = async (password: string): Promise<{ token: string } | null> => {
  try {
    const res = await fetch(`${API_BASE}/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
};

export const fetchAdminSettings = async (): Promise<{ displayDurationSec: number; cropPercent: number; musicUrl?: string | null } | null> => {
  try {
    const res = await fetch(`${API_BASE}/admin/settings`, {
      headers: getAuthHeaders()
    });
    if (res.status === 401) throw new Error('Unauthorized');
    if (!res.ok) return null;
    return await res.json();
  } catch (e: any) {
    if (e.message === 'Unauthorized') throw e;
    return null;
  }
};

export const fetchAdminImages = async (): Promise<AdminImageRecord[]> => {
  try {
    const res = await fetch(`${API_BASE}/admin/images`, {
      headers: getAuthHeaders()
    });
    if (res.status === 401) throw new Error('Unauthorized');
    if (!res.ok) return [];
    return await res.json();
  } catch (e: any) {
    if (e.message === 'Unauthorized') throw e;
    return [];
  }
};

export const updateAdminSettings = async (settings: { displayDurationSec: number; cropPercent: number }): Promise<boolean> => {
  try {
    const res = await fetch(`${API_BASE}/admin/settings`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(settings)
    });
    if (res.status === 401) throw new Error('Unauthorized');
    return res.ok;
  } catch (e: any) {
    if (e.message === 'Unauthorized') throw e;
    return false;
  }
};

export const refreshAdminSync = async (): Promise<{ ok: boolean; newCount?: number; deactivatedCount?: number; reactivatedCount?: number; reason?: string; skipped?: boolean }> => {
  try {
    const res = await fetch(`${API_BASE}/admin/refresh`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    if (res.status === 401) throw new Error('Unauthorized');
    const data = await res.json().catch(() => ({}));
    return res.ok ? { ok: true, ...data } : { ok: false, ...data };
  } catch (e: any) {
    if (e.message === 'Unauthorized') throw e;
    return { ok: false, reason: 'Sync failed' };
  }
};

export const deactivateAdminImage = async (id: string): Promise<{ ok: boolean; message?: string }> => {
  try {
    const res = await fetch(`${API_BASE}/admin/images/${id}/deactivate`, {
      method: 'POST',
      headers: getAuthHeaders(false)
    });
    if (res.status === 401) throw new Error('Unauthorized');
    const data = await res.json().catch(() => ({}));
    return res.ok ? { ok: true } : { ok: false, message: data?.message };
  } catch (e: any) {
    if (e.message === 'Unauthorized') throw e;
    return { ok: false, message: 'Request failed' };
  }
};

export const activateAdminImage = async (id: string): Promise<{ ok: boolean; message?: string }> => {
  try {
    const res = await fetch(`${API_BASE}/admin/images/${id}/activate`, {
      method: 'POST',
      headers: getAuthHeaders(false)
    });
    if (res.status === 401) throw new Error('Unauthorized');
    const data = await res.json().catch(() => ({}));
    return res.ok ? { ok: true } : { ok: false, message: data?.message };
  } catch (e: any) {
    if (e.message === 'Unauthorized') throw e;
    return { ok: false, message: 'Request failed' };
  }
};

export const uploadAdminFiles = async (files: File[]): Promise<{ ok: boolean; uploaded?: number; skipped?: number; message?: string }> => {
  try {
    const form = new FormData();
    files.forEach(file => {
      form.append('files', file, file.name);
    });
    const res = await fetch(`${API_BASE}/admin/upload`, {
      method: 'POST',
      headers: getAuthHeaders(false),
      body: form
    });
    if (res.status === 401) throw new Error('Unauthorized');
    const data = await res.json().catch(() => ({}));
    return res.ok ? { ok: true, ...data } : { ok: false, message: data?.message || 'Upload failed' };
  } catch (e: any) {
    if (e.message === 'Unauthorized') throw e;
    return { ok: false, message: 'Upload failed' };
  }
};

export const uploadAdminMusic = async (file: File): Promise<{ ok: boolean; musicUrl?: string; message?: string }> => {
  try {
    const form = new FormData();
    form.append('file', file, file.name);
    const res = await fetch(`${API_BASE}/admin/music`, {
      method: 'POST',
      headers: getAuthHeaders(false),
      body: form
    });
    if (res.status === 401) throw new Error('Unauthorized');
    const data = await res.json().catch(() => ({}));
    return res.ok ? { ok: true, ...data } : { ok: false, message: data?.message || 'Upload failed' };
  } catch (e: any) {
    if (e.message === 'Unauthorized') throw e;
    return { ok: false, message: 'Upload failed' };
  }
};

export const deleteAdminImage = async (id: string): Promise<{ ok: boolean; message?: string }> => {
  try {
    const res = await fetch(`${API_BASE}/admin/images/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(false)
    });
    if (res.status === 401) throw new Error('Unauthorized');
    const data = await res.json().catch(() => ({}));
    return res.ok ? { ok: true } : { ok: false, message: data?.message };
  } catch (e: any) {
    if (e.message === 'Unauthorized') throw e;
    return { ok: false, message: 'Request failed' };
  }
};

// --- Contact ---
export const sendContact = async (data: { email: string; message: string }): Promise<boolean> => {
  try {
    const res = await fetch(`${API_BASE}/contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      console.error('[Contact] Send failed:', res.status, body?.error || '');
    }
    return res.ok;
  } catch (err) {
    console.error('[Contact] Network error:', err);
    return false;
  }
};