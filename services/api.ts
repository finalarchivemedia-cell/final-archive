import { AppSettings, ImageRecord } from '../types';

const API_ORIGIN = (import.meta as any).env?.VITE_API_BASE_URL || '';
const API_BASE = `${API_ORIGIN}/api`;

// --- Public Endpoints ---

export const fetchImageList = async (): Promise<ImageRecord[]> => {
  try {
    const res = await fetch(`${API_BASE}/images`);
    if (!res.ok) throw new Error('Failed to fetch images');
    return await res.json();
  } catch (err) {
    console.error(err);
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

export const fetchPublicSettings = async (): Promise<{ displayDurationSec: number; cropPercent: number } | null> => {
  try {
    const res = await fetch(`${API_BASE}/settings`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
};


// --- Admin Endpoints ---

const getAuthHeaders = () => {
  const token = localStorage.getItem('admin_token');
  return {
    'Content-Type': 'application/json',
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

export const fetchAdminSettings = async (): Promise<{ displayDurationSec: number; cropPercent: number } | null> => {
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

// --- Contact ---
export const sendContact = async (data: { email: string; message: string }): Promise<boolean> => {
  try {
    const res = await fetch(`${API_BASE}/contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.ok;
  } catch {
    return false;
  }
};