// E2E helpers for pong.html and space-invaders.html. Test-only code.
import { pathToFileURL, fileURLToPath } from 'node:url';

export function fileUrl(fileName) {
  return pathToFileURL(fileURLToPath(new URL(`../../${fileName}`, import.meta.url))).href;
}

// Opens a game from file:// and records console output and other requests.
export async function openArcade(page, fileName, { initScript, initArg } = {}) {
  const url = fileUrl(fileName);
  const logs = [];
  const requests = [];
  page.on('console', (m) => {
    // Chrome warns when a test reads the canvas back many times.
    if (/willReadFrequently/.test(m.text())) return;
    logs.push(`${m.type()}: ${m.text()}`);
  });
  page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
  page.on('request', (r) => { if (r.url() !== url) requests.push(r.url()); });
  if (initScript) await page.addInitScript(initScript, initArg);
  await page.goto(url);
  return { logs, requests };
}

// Returns { total, other }: sampled canvas pixels and how many are not pure
// black or pure white (requirements S2).
export async function colorCensus(page, step = 3) {
  return page.evaluate((st) => {
    const c = document.getElementById('screen');
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let total = 0, other = 0, white = 0;
    for (let y = 0; y < c.height; y += st) {
      for (let x = 0; x < c.width; x += st) {
        const i = (y * c.width + x) * 4;
        total++;
        const r = d[i], g = d[i + 1], b = d[i + 2];
        if (r === 255 && g === 255 && b === 255) white++;
        else if (!(r === 0 && g === 0 && b === 0)) other++;
      }
    }
    return { total, other, white };
  }, step);
}

// Init script: replaces AudioContext with a recorder. window.__audio holds
// { created, state, tones: [{ freq, start, stop }], noises, loops }.
// startState 'suspended' makes a new context start suspended.
export function audioStub(startState) {
  const rec = { created: 0, state: startState === 'suspended' ? 'suspended' : 'running', tones: [], noises: [], loops: [] };
  window.__audio = rec;
  const param = (v = 0) => ({
    value: v,
    setValueAtTime(x) { this.value = x; },
    linearRampToValueAtTime() {},
    exponentialRampToValueAtTime() {}
  });
  const node = () => ({ connect() {}, disconnect() {} });
  class FakeCtx {
    constructor() { rec.created++; this.currentTime = 0; this.sampleRate = 8000; this.destination = node(); }
    get state() { return rec.state; }
    createGain() { return { ...node(), gain: param(1) }; }
    createBiquadFilter() { return { ...node(), type: '', frequency: param(0) }; }
    createBuffer(ch, len) { const d = new Float32Array(len); return { getChannelData: () => d }; }
    createBufferSource() {
      return { ...node(), buffer: null, loop: false, start(t) { this.t0 = t || 0; }, stop(t) { rec.noises.push({ start: this.t0, stop: t }); } };
    }
    createOscillator() {
      const o = {
        ...node(), type: 'sine', frequency: param(440),
        start(t) { this.t0 = t; if (t === undefined) rec.loops.push({ freq: this.frequency.value, osc: this }); },
        stop(t) { if (this.t0 !== undefined) rec.tones.push({ freq: this.frequency.value, start: this.t0, stop: t }); this.stopped = true; }
      };
      return o;
    }
    suspend() { rec.state = 'suspended'; return Promise.resolve(); }
    resume() { rec.state = 'running'; return Promise.resolve(); }
  }
  window.AudioContext = FakeCtx;
  window.webkitAudioContext = FakeCtx;
}

// Init script: makes localStorage throw on every access.
export function blockStorage() {
  Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } });
}

// Fires blur and a hidden visibility state, then restores visibility.
export async function hideTab(page) {
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('blur'));
  });
}

export async function showTab(page) {
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
}
