// truevision/utils/logBuffer.js
//
// Lightweight in-memory console ring buffer. Patches console.log/warn/error at
// import time to keep the most recent N lines so a bug report can optionally
// attach real console/crash output. Bounded — never grows unbounded, never
// blocks, and still forwards to the original console.
//
// Installed early by importing it once in App.js.

const MAX_LINES = 300;
const buffer = [];

const fmt = (args) =>
  args
    .map((a) => {
      if (typeof a === 'string') return a;
      try { return JSON.stringify(a); } catch { return String(a); }
    })
    .join(' ');

const record = (level, args) => {
  // No Date.now() dependency concerns here — plain runtime logging.
  const line = `[${level}] ${fmt(args)}`;
  buffer.push(line.length > 1000 ? line.slice(0, 1000) + '…' : line);
  if (buffer.length > MAX_LINES) buffer.shift();
};

let installed = false;
export function installLogBuffer() {
  if (installed) return;
  installed = true;
  ['log', 'warn', 'error', 'info'].forEach((level) => {
    const original = console[level]?.bind(console);
    if (!original) return;
    console[level] = (...args) => {
      try { record(level, args); } catch { /* never let logging crash the app */ }
      original(...args);
    };
  });
}

/** Recent log lines as a single string (newest last). */
export function getLogs() {
  return buffer.join('\n');
}

export function clearLogs() {
  buffer.length = 0;
}

// Self-install on first import.
installLogBuffer();
