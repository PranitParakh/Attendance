/**
 * Client-First & Backend-Hybrid Data Layer for Attendly.
 * Enables 100% free static hosting on Vercel, Netlify, Cloudflare Pages, or GitHub Pages
 * with zero backend required. Also supports optional local backend when running on desktop.
 */

import type { AttendanceDataset, UploadResponse, SubjectDetailResponse, AttendanceRecord } from './types';
import {
  parseAttendancePdf,
  calculateSubjectSummaries,
  calculateOverallSummary,
} from './clientParser';

const DEFAULT_CLOUD_API = 'https://attendance-1xra.onrender.com/api';

// Dynamic API base: checks localStorage override, then environment variable,
// then falls back to local dev proxy on localhost, or the live cloud backend in production.
export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const custom = localStorage.getItem('attendly_api_base_url');
    if (custom) return custom.replace(/\/+$/, '');
  }
  const envUrl = (import.meta.env.VITE_API_URL as string);
  if (envUrl) return envUrl.replace(/\/+$/, '');

  // If running locally in development, use local Vite proxy
  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    return '/api';
  }

  // When deployed online (Cloudflare Pages, Android PWA, etc.), use the live Render backend
  return DEFAULT_CLOUD_API;
}

export function setApiBaseUrl(url: string | null): void {
  if (typeof window !== 'undefined') {
    if (url) {
      localStorage.setItem('attendly_api_base_url', url.replace(/\/+$/, ''));
    } else {
      localStorage.removeItem('attendly_api_base_url');
    }
  }
}

const DATASET_STORAGE_KEY = 'attendly_saved_dataset';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

/**
 * Upload and parse an attendance PDF.
 * Executes 100% client-side in the browser using PDF.js.
 * Also synchronizes with local backend SQLite database if online.
 */
export async function uploadAttendancePDF(file: File): Promise<UploadResponse> {
  try {
    // 1. Client-side parsing (works 100% offline, on PC and Android)
    const { metadata, records } = await parseAttendancePdf(file, file.name);

    // 2. Client-side statistics calculation
    const subjects = calculateSubjectSummaries(records);
    const overall = calculateOverallSummary(records, subjects);

    // 3. Assemble dataset
    const dataset: AttendanceDataset = {
      metadata,
      records,
      subjects,
      overall,
      imported_at: new Date().toISOString(),
      source_filename: file.name,
    };

    // 4. Save locally in localStorage for instant retrieval & offline capability
    try {
      localStorage.setItem(DATASET_STORAGE_KEY, JSON.stringify(dataset));
    } catch (storageErr) {
      console.warn('Could not cache dataset in localStorage:', storageErr);
    }

    // 5. Opportunistically sync with local backend if running
    try {
      const formData = new FormData();
      formData.append('file', file);
      fetch(`${getApiBaseUrl()}/attendance/upload`, {
        method: 'POST',
        body: formData,
      }).catch(() => {
        // Statically hosted; no backend present
      });
    } catch {
      // ignore backend sync error
    }

    return {
      success: true,
      message: 'Attendance imported successfully',
      dataset,
      records_count: records.length,
      error: null,
    };
  } catch (err: any) {
    console.error('Client-side PDF parsing error:', err);
    throw new ApiError(
      err?.message || 'Unable to parse attendance PDF. Please ensure this is a valid NMIMS SAP report.',
      400
    );
  }
}

/**
 * Imports and parses a Base64 encoded PDF string (from 1-Tap Sync or Bookmarklet).
 * Decodes the base64, runs client-side parsing via PDF.js, and saves to localStorage.
 */
export async function importBase64Pdf(
  base64Data: string,
  filename: string = 'portal_sync.pdf'
): Promise<UploadResponse> {
  try {
    const cleanBase64 = base64Data.replace(/^data:application\/pdf;base64,/, '').trim();
    const binaryString = atob(cleanBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const { metadata, records } = await parseAttendancePdf(bytes, filename);
    const subjects = calculateSubjectSummaries(records);
    const overall = calculateOverallSummary(records, subjects);

    const dataset: AttendanceDataset = {
      metadata,
      records,
      subjects,
      overall,
      imported_at: new Date().toISOString(),
      source_filename: filename,
    };

    try {
      localStorage.setItem(DATASET_STORAGE_KEY, JSON.stringify(dataset));
    } catch (storageErr) {
      console.warn('Could not cache dataset in localStorage:', storageErr);
    }

    return {
      success: true,
      message: 'Attendance imported successfully via 1-Tap Portal Sync',
      dataset,
      records_count: records.length,
      error: null,
    };
  } catch (err: any) {
    console.error('1-Tap Sync PDF parsing error:', err);
    throw new ApiError(
      err?.message || 'Unable to parse synchronized attendance report.',
      400
    );
  }
}


/**
 * Get current attendance dataset.
 * Checks localStorage first, then falls back to backend if available.
 */
export async function getCurrentAttendance(): Promise<AttendanceDataset> {
  // 1. Check local client storage
  try {
    const cached = localStorage.getItem(DATASET_STORAGE_KEY);
    if (cached) {
      const parsed: AttendanceDataset = JSON.parse(cached);
      if (parsed && parsed.metadata && Array.isArray(parsed.records)) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Failed to parse cached dataset from localStorage:', e);
  }

  // 2. Fall back to backend if available
  try {
    const response = await fetch(`${getApiBaseUrl()}/attendance/current`);
    if (response.ok) {
      const data: AttendanceDataset = await response.json();
      try {
        localStorage.setItem(DATASET_STORAGE_KEY, JSON.stringify(data));
      } catch {}
      return data;
    }
  } catch {
    // Backend offline / not hosted
  }

  throw new ApiError('No attendance data found. Please upload a PDF first.', 404);
}

/**
 * Get detailed data for a specific subject.
 */
export async function getSubjectDetail(subjectName: string): Promise<SubjectDetailResponse> {
  const decoded = decodeURIComponent(subjectName);

  // Try retrieving from current dataset
  try {
    const dataset = await getCurrentAttendance();
    const records = dataset.records.filter(r => r.course_normalized === decoded);

    if (records.length === 0) {
      throw new ApiError(`Subject '${decoded}' not found`, 404);
    }

    const summaries = calculateSubjectSummaries(records);
    records.sort((a, b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time));

    return {
      summary: summaries[0],
      records,
    };
  } catch (e: any) {
    if (e instanceof ApiError && e.status === 404) throw e;
  }

  // Fallback to backend API
  const encoded = encodeURIComponent(subjectName);
  const response = await fetch(`${getApiBaseUrl()}/attendance/subjects/${encoded}`);
  if (!response.ok) {
    throw new ApiError(`Subject '${decoded}' not found`, response.status);
  }
  return response.json();
}

/**
 * Delete the current attendance dataset.
 * Clears client-side cached dataset and notifies backend if available.
 */
export async function deleteCurrentAttendance(): Promise<void> {
  localStorage.removeItem(DATASET_STORAGE_KEY);

  try {
    await fetch(`${getApiBaseUrl()}/attendance/current`, {
      method: 'DELETE',
    });
  } catch {
    // Backend not running / static host
  }
}

/**
 * Check if the Python backend (with Playwright scraper) is actively running.
 */
export async function isBackendConnected(): Promise<boolean> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/health`, { signal: AbortSignal.timeout(1500) });
    const contentType = res.headers.get('content-type') || '';
    return res.ok && contentType.includes('application/json');
  } catch {
    return false;
  }
}

/**
 * Check if the application is available.
 * Returns true because the client-side parsing operates autonomously.
 */
export async function checkHealth(): Promise<boolean> {
  return true;
}

/**
 * Fetch attendance from the SAP portal directly using Playwright (requires local desktop runner).
 */
export async function fetchAttendancePortal(
  username: string,
  password: string,
  headless: boolean = false
): Promise<UploadResponse> {
  try {
    const response = await fetch(`${getApiBaseUrl()}/attendance/fetch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password, headless }),
    });

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      throw new ApiError(
        'Direct SAP portal scraping requires the local desktop runner (start_app.bat) with Playwright. On web and mobile, please use the Upload PDF tab!',
        503
      );
    }

    if (!response.ok) {
      let msg = `Portal sync failed (${response.status})`;
      try {
        const body = await response.json();
        msg = body.detail || body.message || msg;
      } catch {}
      throw new ApiError(msg, response.status);
    }

    const result: UploadResponse = await response.json();
    if (result.dataset) {
      try {
        localStorage.setItem(DATASET_STORAGE_KEY, JSON.stringify(result.dataset));
      } catch {}
    }
    return result;
  } catch (err: any) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(
      'Direct SAP portal scraping requires the local desktop runner (start_app.bat) with Playwright. On web and mobile, please use the Upload PDF tab!',
      503
    );
  }
}
