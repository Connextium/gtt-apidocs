/**
 * GTT Business Client API Docs - Dual-Viewer Controller
 * Manages Scalar & Redoc rendering, switching, theme persistence, and spec loading.
 */

(function () {
  'use strict';

  const LIVE_SPEC_URL = 'https://gtt-api.connextium.xyz/openapi/business-client.json';
  const LOCAL_SPEC_URL = './openapi/business-client.json';

  const state = {
    currentViewer: localStorage.getItem('gtt_docs_viewer') || 'scalar', // 'scalar' | 'redoc'
    currentTheme: localStorage.getItem('gtt_docs_theme') || 'light',    // 'light' | 'dark'
    specSource: 'auto', // 'live' | 'local' | 'auto'
    specData: null,
    isInitialized: {
      scalar: false,
      redoc: false
    }
  };

  // DOM Elements
  const elements = {
    themeBtn: document.getElementById('theme-toggle-btn'),
    btnScalar: document.getElementById('btn-view-scalar'),
    btnRedoc: document.getElementById('btn-view-redoc'),
    paneScalar: document.getElementById('pane-scalar'),
    paneRedoc: document.getElementById('pane-redoc'),
    downloadBtn: document.getElementById('btn-download-spec'),
    copyUrlBtn: document.getElementById('btn-copy-url'),
    loadingOverlay: document.getElementById('loading-overlay'),
    endpointCount: document.getElementById('endpoint-count'),
    apiVersion: document.getElementById('api-version'),
    toast: document.getElementById('toast'),
    toastMsg: document.getElementById('toast-msg'),
    btnAskAi: document.getElementById('btn-ask-ai'),
    aiModal: document.getElementById('ai-modal'),
    aiModalClose: document.getElementById('ai-modal-close'),
    aiQueryInput: document.getElementById('ai-query-input'),
    aiSubmitBtn: document.getElementById('ai-submit-btn'),
    aiResultContainer: document.getElementById('ai-result-container'),
    aiResponseContent: document.getElementById('ai-response-content'),
    btnCopyAiAnswer: document.getElementById('btn-copy-ai-answer'),
    aiChips: document.querySelectorAll('.ai-chip')
  };

  // Toast Notification
  function showToast(message, duration = 2500) {
    if (!elements.toast) return;
    elements.toastMsg.textContent = message;
    elements.toast.classList.add('show');
    setTimeout(() => {
      elements.toast.classList.remove('show');
    }, duration);
  }

  // Theme Management
  function applyTheme(theme) {
    state.currentTheme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.classList.remove('dark', 'light', 'dark-mode', 'light-mode');
    document.documentElement.classList.add(theme, `${theme}-mode`);
    if (document.body) {
      document.body.classList.remove('dark', 'light', 'dark-mode', 'light-mode');
      document.body.classList.add(theme, `${theme}-mode`);
    }
    localStorage.setItem('gtt_docs_theme', theme);

    // Update Theme toggle button icon & title
    if (elements.themeBtn) {
      elements.themeBtn.innerHTML = theme === 'dark'
        ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>`
        : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
      elements.themeBtn.title = `Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`;
    }

    // Re-render active viewer to ensure content area reflects theme changes immediately
    if (state.specData) {
      if (state.currentViewer === 'scalar') {
        renderScalar(state.specData);
        state.isInitialized.redoc = false;
      } else if (state.currentViewer === 'redoc') {
        renderRedoc(state.specData);
        state.isInitialized.scalar = false;
      }
    }
  }

  function normalizeSpec(spec, sourceUrl) {
    if (!spec || typeof spec !== 'object') return spec;
    try {
      const origin = new URL(sourceUrl, window.location.href).origin;
      if (origin && !origin.startsWith('http://localhost') && !origin.startsWith('http://127.0.0.1')) {
        const existingServers = Array.isArray(spec.servers) ? spec.servers : [];
        const otherServers = existingServers.filter(s => s && s.url && s.url.replace(/\/+$/, '') !== origin.replace(/\/+$/, ''));
        spec.servers = [
          { url: origin, description: 'Production API Server' },
          ...otherServers
        ];
      }
    } catch (e) {
      // Ignore URL parsing errors
    }
    return spec;
  }

  // Fetch OpenAPI Spec with smart fallback
  async function loadSpec() {
    // 1. Check if spec is embedded statically in window
    if (window.__GTT_BUNDLED_SPEC__) {
      state.specData = normalizeSpec(window.__GTT_BUNDLED_SPEC__, LIVE_SPEC_URL);
      return state.specData;
    }

    // 2. Try fetching from live endpoint or local fallback
    try {
      const livePromise = fetch(LIVE_SPEC_URL, { cache: 'no-cache' }).then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      });

      // Add a 4 second timeout for live fetch before fallback to local
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Live fetch timeout')), 4000)
      );

      const rawSpec = await Promise.race([livePromise, timeoutPromise]);
      state.specData = normalizeSpec(rawSpec, LIVE_SPEC_URL);
      return state.specData;
    } catch (liveErr) {
      console.warn('Live OpenAPI spec fetch failed or timed out. Falling back to local spec...', liveErr);
      try {
        const localRes = await fetch(LOCAL_SPEC_URL);
        if (!localRes.ok) throw new Error(`HTTP ${localRes.status}`);
        const localSpec = await localRes.json();
        state.specData = normalizeSpec(localSpec, LIVE_SPEC_URL);
        return state.specData;
      } catch (localErr) {
        console.error('Failed to load local spec fallback:', localErr);
        throw new Error('Unable to load OpenAPI specification from live URL or local storage.');
      }
    }
  }

  // Render Scalar API Reference
  function renderScalar(spec) {
    if (!elements.paneScalar) return;
    elements.paneScalar.innerHTML = '';

    // Create container for Scalar
    const scalarContainer = document.createElement('div');
    scalarContainer.id = 'scalar-root';
    scalarContainer.style.width = '100%';
    scalarContainer.style.height = '100%';
    elements.paneScalar.appendChild(scalarContainer);

    try {
      const isDark = state.currentTheme === 'dark';
      const specString = typeof spec === 'string' ? spec : JSON.stringify(spec);

      if (window.Scalar && typeof window.Scalar.createApiReference === 'function') {
        window.Scalar.createApiReference(scalarContainer, {
          content: specString,
          darkMode: isDark,
          layout: 'modern',
          showSidebar: true,
          hideDownloadButton: true,
          proxyUrl: 'https://proxy.scalar.com',
          metaData: {
            title: spec.info?.title || 'GTT Business Client API'
          }
        });
      } else if (window.Scalar && typeof window.Scalar.createScalarReferences === 'function') {
        window.Scalar.createScalarReferences(scalarContainer, {
          spec: { content: spec },
          darkMode: isDark,
          showSidebar: true,
          hideDownloadButton: true
        });
      } else {
        // Declarative CDN fallback
        const script = document.createElement('script');
        script.id = 'api-reference';
        script.type = 'application/json';
        script.dataset.configuration = JSON.stringify({ darkMode: isDark });
        script.textContent = specString;
        scalarContainer.appendChild(script);

        if (!document.querySelector('script[src*="@scalar/api-reference"]')) {
          const scalarScript = document.createElement('script');
          scalarScript.src = 'https://cdn.jsdelivr.net/npm/@scalar/api-reference';
          scalarScript.crossOrigin = 'anonymous';
          document.body.appendChild(scalarScript);
        }
      }
      state.isInitialized.scalar = true;
    } catch (err) {
      console.error('Failed to render Scalar:', err);
      elements.paneScalar.innerHTML = `<div style="padding: 2rem; color: #ef4444;">Error rendering Scalar Reference: ${err.message}</div>`;
    }
  }

  // Render Redoc API Reference
  function renderRedoc(spec) {
    if (!elements.paneRedoc || !window.Redoc) return;
    elements.paneRedoc.innerHTML = '';

    const isDark = state.currentTheme === 'dark';
    const redocOptions = {
      theme: {
        colors: {
          primary: { main: isDark ? '#6366f1' : '#4f46e5' },
          success: { main: '#10b981' },
          warning: { main: '#f59e0b' },
          error: { main: '#ef4444' },
          text: {
            primary: isDark ? '#f3f4f6' : '#0f172a',
            secondary: isDark ? '#9ca3af' : '#475569'
          },
          http: {
            get: '#3b82f6',
            post: '#10b981',
            put: '#f59e0b',
            delete: '#ef4444',
            patch: '#8b5cf6'
          }
        },
        typography: {
          fontSize: '14px',
          lineHeight: '1.5em',
          fontFamily: "'Inter', sans-serif",
          headings: {
            fontFamily: "'Inter', sans-serif",
            fontWeight: '600'
          },
          code: {
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            fontSize: '13px'
          }
        },
        sidebar: {
          backgroundColor: isDark ? '#0b0f17' : '#ffffff',
          textColor: isDark ? '#d1d5db' : '#334155',
          activeTextColor: isDark ? '#a5b4fc' : '#4f46e5',
          width: '280px'
        },
        rightPanel: {
          backgroundColor: isDark ? '#121824' : '#f8fafc',
          textColor: isDark ? '#f3f4f6' : '#0f172a',
          width: '40%'
        },
        codeBlock: {
          backgroundColor: isDark ? '#0b0f17' : '#f1f5f9',
          tokens: isDark ? {} : {}
        },
        schema: {
          linesColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
          typeNameColor: isDark ? '#9ca3af' : '#64748b',
          typeTitleColor: isDark ? '#e2e8f0' : '#1e293b'
        }
      },
      hideDownloadButton: true,
      scrollYOffset: 64,
      expandResponses: '200,201',
      jsonSampleExpandLevel: 2,
      pathInMiddlePanel: true
    };

    try {
      window.Redoc.init(spec, redocOptions, elements.paneRedoc, () => {
        state.isInitialized.redoc = true;
      });
    } catch (err) {
      console.error('Failed to render Redoc:', err);
      elements.paneRedoc.innerHTML = `<div style="padding: 2rem; color: #ef4444;">Error rendering Redoc: ${err.message}</div>`;
    }
  }

  // Switch Active Viewer
  function switchViewer(viewerName) {
    state.currentViewer = viewerName;
    localStorage.setItem('gtt_docs_viewer', viewerName);

    if (viewerName === 'scalar') {
      elements.btnScalar?.classList.add('active');
      elements.btnRedoc?.classList.remove('active');
      elements.paneScalar?.classList.add('active');
      elements.paneRedoc?.classList.remove('active');

      if (!state.isInitialized.scalar && state.specData) {
        renderScalar(state.specData);
      }
    } else {
      elements.btnRedoc?.classList.add('active');
      elements.btnScalar?.classList.remove('active');
      elements.paneRedoc?.classList.add('active');
      elements.paneScalar?.classList.remove('active');

      if (!state.isInitialized.redoc && state.specData) {
        renderRedoc(state.specData);
      }
    }
  }

  // Download Spec as JSON
  function downloadSpecJSON() {
    if (!state.specData) {
      showToast('Spec not loaded yet');
      return;
    }
    const blob = new Blob([JSON.stringify(state.specData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gtt-business-client-openapi-${state.specData.info?.version || 'v1'}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Downloaded OpenAPI JSON');
  }

  // Copy Live Spec URL
  function copySpecUrl() {
    navigator.clipboard.writeText(LIVE_SPEC_URL).then(() => {
      showToast('Copied OpenAPI URL to clipboard!');
    }).catch(() => {
      showToast('Failed to copy URL');
    });
  }

  // Ask AI Slide Panel Management
  function openAiModal(initialQuery = '') {
    if (!elements.aiModal) return;
    elements.aiModal.classList.add('open');
    elements.btnAskAi?.classList.add('active');
    if (initialQuery && elements.aiQueryInput) {
      elements.aiQueryInput.value = initialQuery;
      handleAiSearch(initialQuery);
    } else if (elements.aiQueryInput) {
      setTimeout(() => elements.aiQueryInput.focus(), 80);
    }
  }

  function closeAiModal() {
    if (!elements.aiModal) return;
    elements.aiModal.classList.remove('open');
    elements.btnAskAi?.classList.remove('active');
  }

  function toggleAiModal() {
    if (elements.aiModal?.classList.contains('open')) {
      closeAiModal();
    } else {
      openAiModal();
    }
  }

  async function handleAiSearch(forcedQuery) {
    const query = forcedQuery || elements.aiQueryInput?.value.trim();
    if (!query) return;

    if (elements.aiResultContainer && elements.aiResponseContent) {
      elements.aiResultContainer.style.display = 'flex';
      elements.aiResponseContent.innerHTML = `
        <div class="ai-loading-state">
          <div class="ai-loading-spinner"></div>
          <span>Analyzing OpenAPI spec and formulating response...</span>
        </div>
      `;
    }

    if (elements.aiSubmitBtn) {
      elements.aiSubmitBtn.disabled = true;
      elements.aiSubmitBtn.style.opacity = '0.6';
    }

    try {
      const answer = await askAI(query);
      if (elements.aiResponseContent) {
        elements.aiResponseContent.textContent = answer;
      }
    } catch (err) {
      if (elements.aiResponseContent) {
        elements.aiResponseContent.innerHTML = `
          <div style="color: #ef4444; font-weight: 500;">
            ⚠️ Error: ${err.message}
          </div>
        `;
      }
    } finally {
      if (elements.aiSubmitBtn) {
        elements.aiSubmitBtn.disabled = false;
        elements.aiSubmitBtn.style.opacity = '1';
      }
    }
  }

  async function askAI(userQuery) {
    const response = await fetch('/api/ask-ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: userQuery })
    });
    const data = await response.json();
    if (!response.ok || data.error) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }
    return data.answer || 'No answer returned.';
  }

  function copyAiAnswer() {
    if (!elements.aiResponseContent) return;
    const text = elements.aiResponseContent.innerText;
    navigator.clipboard.writeText(text).then(() => {
      showToast('Copied AI response to clipboard!');
    }).catch(() => {
      showToast('Failed to copy response');
    });
  }

  // Bind Event Handlers
  function bindEvents() {
    elements.themeBtn?.addEventListener('click', () => {
      applyTheme(state.currentTheme === 'dark' ? 'light' : 'dark');
    });

    elements.btnScalar?.addEventListener('click', () => switchViewer('scalar'));
    elements.btnRedoc?.addEventListener('click', () => switchViewer('redoc'));

    elements.downloadBtn?.addEventListener('click', downloadSpecJSON);
    elements.copyUrlBtn?.addEventListener('click', copySpecUrl);

    // Ask AI triggers
    elements.btnAskAi?.addEventListener('click', toggleAiModal);
    elements.aiModalClose?.addEventListener('click', closeAiModal);
    elements.aiModal?.addEventListener('click', (e) => {
      if (e.target === elements.aiModal) closeAiModal();
    });
    elements.aiSubmitBtn?.addEventListener('click', () => handleAiSearch());
    elements.aiQueryInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleAiSearch();
    });
    elements.btnCopyAiAnswer?.addEventListener('click', copyAiAnswer);

    elements.aiChips?.forEach(chip => {
      chip.addEventListener('click', () => {
        const query = chip.getAttribute('data-query');
        if (elements.aiQueryInput) elements.aiQueryInput.value = query;
        handleAiSearch(query);
      });
    });

    // Keyboard shortcut (1 for Modern, 2 for Classic, T for Theme, / or Cmd+K for AI)
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && elements.aiModal?.classList.contains('open')) {
        closeAiModal();
        return;
      }
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === '1') switchViewer('scalar');
      if (e.key === '2') switchViewer('redoc');
      if (e.key === 't' || e.key === 'T') {
        applyTheme(state.currentTheme === 'dark' ? 'light' : 'dark');
      }
      if (e.key === '/' || ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K'))) {
        e.preventDefault();
        openAiModal();
      }
    });
  }

  // App Initialization
  async function init() {
    applyTheme(state.currentTheme);
    bindEvents();

    try {
      const spec = await loadSpec();

      // Update API stats
      if (elements.apiVersion) {
        elements.apiVersion.textContent = `v${spec.info?.version || '1.0'}`;
      }
      if (elements.endpointCount && spec.paths) {
        const count = Object.keys(spec.paths).length;
        elements.endpointCount.textContent = `${count} Endpoints`;
      }

      // Hide loading overlay
      if (elements.loadingOverlay) {
        elements.loadingOverlay.style.opacity = '0';
        setTimeout(() => {
          elements.loadingOverlay.style.display = 'none';
        }, 300);
      }

      // Render initial viewer
      if (state.currentViewer === 'scalar') {
        switchViewer('scalar');
        // Pre-warm redoc in background
        setTimeout(() => {
          if (window.Redoc && !state.isInitialized.redoc) renderRedoc(spec);
        }, 1000);
      } else {
        switchViewer('redoc');
        // Pre-warm scalar in background
        setTimeout(() => {
          if (!state.isInitialized.scalar) renderScalar(spec);
        }, 1000);
      }

    } catch (err) {
      console.error('Initialization error:', err);
      if (elements.loadingOverlay) {
        elements.loadingOverlay.innerHTML = `
          <div style="text-align: center; max-width: 480px; padding: 2rem;">
            <div style="font-size: 2rem; margin-bottom: 1rem;">⚠️</div>
            <h3 style="color: #ef4444; margin-bottom: 0.5rem;">Failed to Load OpenAPI Specification</h3>
            <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 1.5rem;">${err.message}</p>
            <button onclick="window.location.reload()" class="action-btn" style="margin: 0 auto;">Retry</button>
          </div>
        `;
      }
    }
  }

  // Start on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
