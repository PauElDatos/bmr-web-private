import { authConfig } from './authClient.js';

const BASE = './data';

const cache = new Map();

export async function loadJson(path) {
  const normalized = path.startsWith('/') ? path.slice(1) : path;
  const cfg = authConfig();
  const baseUrl = cfg.dataBaseUrl || cfg.apiBaseUrl || '';
  const url = baseUrl
    ? `${baseUrl.replace(/\/$/, '')}/${normalized}`
    : `${BASE}/${normalized}`;
  if (cache.has(url)) return cache.get(url);
  const promise = fetch(url, { cache: 'no-cache', credentials: baseUrl ? 'include' : 'same-origin' }).then(async (res) => {
    if (!res.ok) {
      throw new Error(`No se pudo cargar ${url}: HTTP ${res.status}`);
    }
    return res.json();
  });
  cache.set(url, promise);
  return promise;
}

export async function loadManifest() {
  return loadJson('manifest.json');
}

export async function loadMarketModule(moduleCode) {
  return loadJson(`market/${moduleCode.toLowerCase()}.json`);
}

export async function loadMarketWeights(moduleCode) {
  return loadJson(`market/weights/${moduleCode.toLowerCase()}.json`);
}

export async function loadMarketWeightChunk(path) {
  return loadJson(path);
}

export async function loadMarketInputs(moduleCode) {
  return loadJson(`market/inputs/${moduleCode.toLowerCase()}.json`);
}

export async function loadMarketMetrics(moduleCode) {
  return loadJson(`market/metrics/${moduleCode.toLowerCase()}.json`);
}

export async function loadMarketEvents(moduleCode) {
  return loadJson(`market/events/${moduleCode.toLowerCase()}.json`);
}

export async function loadCatalog(kind) {
  return loadJson(`catalog/${kind}.json`);
}

export async function loadTimeseries(kind, code) {
  return loadJson(`timeseries/${kind}/${encodeURIComponent(code)}.json`);
}

export async function loadStatus() {
  return loadJson('status/health.json');
}


export async function loadJsonOptional(path, fallback = null) {
  try {
    return await loadJson(path);
  } catch (err) {
    return fallback;
  }
}

export async function loadAutomationStatus() {
  return loadJsonOptional('status/automation.json', null);
}

export async function loadPublishStatus() {
  return loadJsonOptional('status/publish.json', null);
}

export async function loadLastExport() {
  return loadJsonOptional('status/last_export.json', null);
}
