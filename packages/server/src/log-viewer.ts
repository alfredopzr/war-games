// =============================================================================
// HexWar Server — Log Viewer Routes
// =============================================================================

import { Router } from 'express';
import type { Request, Response, Router as RouterType } from 'express';
import { getAll, getLogs, subscribe, unsubscribe } from './logger';

const router: RouterType = Router();

function authMiddleware(req: Request, res: Response, next: () => void): void {
  const token = req.query.token as string | undefined;
  if (!token || token !== process.env.LOG_TOKEN) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}

router.use(authMiddleware);

router.get('/logs', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/html');
  res.send(viewerHTML);
});

router.get('/logs/stream', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  subscribe(res);

  req.on('close', () => {
    unsubscribe(res);
  });
});

router.get('/logs/history', (_req: Request, res: Response) => {
  const since = _req.query.since ? Number(_req.query.since) : undefined;
  res.json(since !== undefined ? getLogs(since) : getAll());
});

const viewerHTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>HexWar — Log Viewer</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    background: #0d1117;
    color: #c9d1d9;
    font-family: 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
    font-size: 13px;
  }
  #toolbar {
    position: fixed; top: 0; left: 0; right: 0;
    background: #161b22;
    border-bottom: 1px solid #30363d;
    padding: 8px 16px;
    display: flex; gap: 12px; align-items: center;
    z-index: 10;
  }
  #toolbar button, #toolbar select {
    background: #21262d;
    color: #c9d1d9;
    border: 1px solid #30363d;
    padding: 4px 12px;
    border-radius: 4px;
    cursor: pointer;
    font-family: inherit;
    font-size: 12px;
  }
  #toolbar button:hover { background: #30363d; }
  #toolbar .status {
    margin-left: auto;
    font-size: 11px;
    color: #8b949e;
  }
  #toolbar .status .dot {
    display: inline-block;
    width: 8px; height: 8px;
    border-radius: 50%;
    margin-right: 4px;
    vertical-align: middle;
  }
  .dot.connected { background: #3fb950; }
  .dot.disconnected { background: #f85149; }
  #log-container {
    padding: 48px 16px 16px;
    overflow-y: auto;
    height: 100vh;
  }
  .entry {
    padding: 2px 0;
    white-space: pre-wrap;
    word-break: break-all;
  }
  .entry .ts { color: #8b949e; }
  .entry .badge {
    display: inline-block;
    padding: 0 4px;
    border-radius: 3px;
    font-size: 11px;
    font-weight: 600;
    margin: 0 4px;
  }
  .badge.server { background: #1f6feb33; color: #58a6ff; }
  .badge.game { background: #3fb95033; color: #3fb950; }
  .level-info .msg { color: #3fb950; }
  .level-warn .msg { color: #d29922; }
  .level-error .msg { color: #f85149; }
</style>
</head>
<body>
<div id="toolbar">
  <button id="pause-btn">Pause</button>
  <select id="filter">
    <option value="all">All categories</option>
    <option value="server">Server only</option>
    <option value="game">Game only</option>
  </select>
  <span class="status"><span class="dot disconnected" id="status-dot"></span><span id="status-text">Connecting...</span></span>
</div>
<div id="log-container"></div>
<script>
(function() {
  const container = document.getElementById('log-container');
  const pauseBtn = document.getElementById('pause-btn');
  const filterEl = document.getElementById('filter');
  const statusDot = document.getElementById('status-dot');
  const statusText = document.getElementById('status-text');
  let paused = false;
  let filter = 'all';
  let autoScroll = true;

  const token = new URLSearchParams(location.search).get('token');

  function renderEntry(entry) {
    if (filter !== 'all' && entry.category !== filter) return null;
    const div = document.createElement('div');
    div.className = 'entry level-' + entry.level;
    const ts = entry.timestamp.slice(11, 23);
    div.innerHTML =
      '<span class="ts">' + ts + '</span>' +
      '<span class="badge ' + entry.category + '">' + entry.category + '</span>' +
      '<span class="msg">' + escapeHtml(entry.message) + '</span>';
    return div;
  }

  function escapeHtml(s) {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function scrollToBottom() {
    if (autoScroll && !paused) {
      container.scrollTop = container.scrollHeight;
    }
  }

  // Load history
  fetch('/logs/history?token=' + encodeURIComponent(token))
    .then(r => r.json())
    .then(entries => {
      entries.forEach(e => {
        const el = renderEntry(e);
        if (el) container.appendChild(el);
      });
      scrollToBottom();
    });

  // SSE stream
  const es = new EventSource('/logs/stream?token=' + encodeURIComponent(token));
  es.onopen = () => {
    statusDot.className = 'dot connected';
    statusText.textContent = 'Connected';
  };
  es.onerror = () => {
    statusDot.className = 'dot disconnected';
    statusText.textContent = 'Disconnected';
  };
  es.onmessage = (event) => {
    if (paused) return;
    const entry = JSON.parse(event.data);
    const el = renderEntry(entry);
    if (el) {
      container.appendChild(el);
      scrollToBottom();
    }
  };

  pauseBtn.addEventListener('click', () => {
    paused = !paused;
    pauseBtn.textContent = paused ? 'Resume' : 'Pause';
  });

  filterEl.addEventListener('change', () => {
    filter = filterEl.value;
    // Re-render from history
    container.innerHTML = '';
    fetch('/logs/history?token=' + encodeURIComponent(token))
      .then(r => r.json())
      .then(entries => {
        entries.forEach(e => {
          const el = renderEntry(e);
          if (el) container.appendChild(el);
        });
        scrollToBottom();
      });
  });

  container.addEventListener('scroll', () => {
    const atBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 50;
    autoScroll = atBottom;
  });
})();
</script>
</body>
</html>`;

export { router as logViewerRouter };
