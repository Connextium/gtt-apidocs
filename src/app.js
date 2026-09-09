/**
 * GTT Business Client API Docs - Dual-Viewer Controller
 * Manages Scalar & Redoc rendering, switching, theme persistence, and spec loading.
 */

(function () {
  'use strict';

  const LIVE_SPEC_URL = 'https://gtt-api.vercel.app/openapi/business-client.json';
  const LOCAL_SPEC_URL = './openapi/business-client.json';

  const state = {
    currentViewer: localStorage.getItem('gtt_docs_viewer') || 'scalar', // 'scalar' | 'redoc'
    currentTheme: localStorage.getItem('gtt_docs_theme') || 'dark',     // 'dark' | 'light'
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
    toastMsg: document.getElementById('toast-msg')
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
    localStorage.setItem('gtt_docs_theme', theme);

    // Update Theme toggle button icon
    if (elements.themeBtn) {
      elements.themeBtn.innerHTML = theme === 'dark'
        ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>`
        : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
      elements.themeBtn.title = `Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`;
    }

    // Re-initialize Redoc if active/initialized to reflect theme changes
    if (state.isInitialized.redoc && state.specData) {
      renderRedoc(state.specData);
    }
  }

  // Fetch OpenAPI Spec with smart fallback
  async function loadSpec() {
    // 1. Check if spec is embedded statically in window
    if (window.__GTT_BUNDLED_SPEC__) {
      state.specData = window.__GTT_BUNDLED_SPEC__;
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

      state.specData = await Promise.race([livePromise, timeoutPromise]);
      return state.specData;
    } catch (liveErr) {
      console.warn('Live OpenAPI spec fetch failed or timed out. Falling back to local spec...', liveErr);
      try {
        const localRes = await fetch(LOCAL_SPEC_URL);
        if (!localRes.ok) throw new Error(`HTTP ${localRes.status}`);
        state.specData = await localRes.json();
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
          primary: { main: '#6366f1' },
          success: { main: '#10b981' },
          warning: { main: '#f59e0b' },
          error: { main: '#ef4444' },
          text: {
            primary: isDark ? '#f3f4f6' : '#111827',
            secondary: isDark ? '#9ca3af' : '#4b5563'
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
          backgroundColor: isDark ? '#0b0f17' : '#f8fafc',
          textColor: isDark ? '#d1d5db' : '#374151',
          activeTextColor: '#6366f1',
          width: '280px'
        },
        rightPanel: {
          backgroundColor: isDark ? '#121824' : '#1e293b',
          width: '40%'
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

  // Bind Event Handlers
  function bindEvents() {
    elements.themeBtn?.addEventListener('click', () => {
      applyTheme(state.currentTheme === 'dark' ? 'light' : 'dark');
    });

    elements.btnScalar?.addEventListener('click', () => switchViewer('scalar'));
    elements.btnRedoc?.addEventListener('click', () => switchViewer('redoc'));

    elements.downloadBtn?.addEventListener('click', downloadSpecJSON);
    elements.copyUrlBtn?.addEventListener('click', copySpecUrl);

    // Keyboard shortcut (1 for Scalar, 2 for Redoc, T for Theme)
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === '1') switchViewer('scalar');
      if (e.key === '2') switchViewer('redoc');
      if (e.key === 't' || e.key === 'T') {
        applyTheme(state.currentTheme === 'dark' ? 'light' : 'dark');
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
