/**
 * A Person Said a Thing — Interactive Marquee Engine
 * JS-driven scrolling with drag, click-to-center, and hover expansion
 */

(function () {
  'use strict';

  const TOTAL_ROWS = 7;
  const RESUME_DELAY = 2000;
  const CARD_GAP = 20; // px, matches var(--card-gap)

  // Pixels per animation frame — varied for visual depth
  const ROW_SPEEDS = [0.45, 0.38, 0.52, 0.35, 0.48, 0.40, 0.55];

  // ─── Utility ──────────────────────────────────────────

  function escapeHtml(str) {
    if (!str) return '';
    const el = document.createElement('span');
    el.textContent = str;
    return el.innerHTML;
  }

  // ─── Data Loading ─────────────────────────────────────

  async function loadQuotes() {
    // Try API first (when backend is configured), fall back to static JSON
    for (const url of ['/api/quotes', 'data/quotes.json']) {
      try {
        const r = await fetch(url);
        if (!r.ok) continue;
        const data = await r.json();
        return Array.isArray(data) ? data : (data.results || []);
      } catch { /* try next */ }
    }
    return [];
  }

  function distributeQuotes(quotes, numRows) {
    const rows = Array.from({ length: numRows }, () => []);
    const shuffled = [...quotes].sort(() => Math.random() - 0.5);
    shuffled.forEach((q, i) => rows[i % numRows].push(q));
    return rows;
  }

  // ─── Card Builder ─────────────────────────────────────

  function buildCard(quote) {
    const card = document.createElement('div');
    card.className = 'quote-card';
    card.setAttribute('data-id', quote.id);

    card.innerHTML = `
      <div class="card-main">
        <p class="quote-text">${escapeHtml(quote.text)}</p>
        <div class="card-attribution">
          <a href="${escapeHtml(quote.socialLink)}" target="_blank" rel="noopener"
             class="speaker-thumbnail-link"
             title="Learn more about ${escapeHtml(quote.speaker)}">
            <img src="${escapeHtml(quote.thumbnail)}"
                 alt="${escapeHtml(quote.speaker)}"
                 class="speaker-thumbnail" loading="lazy" />
          </a>
          <div class="attribution-text">
            <span class="speaker-name">${escapeHtml(quote.speaker)}</span>
            <span class="speaker-date">${escapeHtml(quote.date)}</span>
          </div>
        </div>
      </div>
      <div class="card-expanded">
        <div class="expanded-divider"></div>
        <div class="expanded-details">
          ${quote.role ? `<div class="detail-item"><span class="detail-label">Role</span><span class="detail-value">${escapeHtml(quote.role)}</span></div>` : ''}
          ${quote.source ? `<div class="detail-item"><span class="detail-label">Source</span><span class="detail-value">${escapeHtml(quote.sourceDetail || quote.source)}</span></div>` : ''}
          ${quote.historicalContext ? `<div class="detail-item"><span class="detail-label">Context</span><span class="detail-value">${escapeHtml(quote.historicalContext)}</span></div>` : ''}
        </div>
      </div>
    `;

    // Prevent thumbnail link clicks from triggering card center
    const link = card.querySelector('.speaker-thumbnail-link');
    if (link) link.addEventListener('click', e => e.stopPropagation());

    return card;
  }

  // ─── MarqueeRow Class ─────────────────────────────────

  class MarqueeRow {
    constructor(quotes, index, parent) {
      this.quotes = quotes;
      this.index = index;
      // Even rows scroll left (direction = -1), odd rows scroll right (+1)
      this.direction = index % 2 === 0 ? -1 : 1;
      this.speed = ROW_SPEEDS[index] || 0.4;
      this.position = 0;
      this.contentWidth = 0;

      // Interaction state
      this.isDragging = false;
      this.isPaused = false;
      this.wasDragged = false;
      this.dragStartX = 0;
      this.dragStartPos = 0;
      this.velocity = 0;
      this.resumeTimer = null;
      this.animating = false;

      this.build(parent);
      this.measure();
      this.attachEvents();
      this.startLoop();
    }

    build(parent) {
      this.track = document.createElement('div');
      this.track.className = 'marquee-track';
      this.track.style.cursor = 'grab';

      this.rowEl = document.createElement('div');
      this.rowEl.className = 'marquee-row';

      // Render cards twice for seamless infinite loop
      for (let copy = 0; copy < 2; copy++) {
        this.quotes.forEach(q => this.rowEl.appendChild(buildCard(q)));
      }

      this.track.appendChild(this.rowEl);
      parent.appendChild(this.track);
    }

    measure() {
      // Wait a frame for layout
      requestAnimationFrame(() => {
        const cards = this.rowEl.children;
        const half = this.quotes.length;
        if (half === 0) return;

        // Measure the width of the first set of cards + gaps
        let width = 0;
        for (let i = 0; i < half; i++) {
          width += cards[i].offsetWidth + CARD_GAP;
        }
        this.contentWidth = width;

        // Right-scrolling rows start offset so seamless loop works
        if (this.direction === 1) {
          this.position = -this.contentWidth;
        }
        this.applyTransform();
      });
    }

    attachEvents() {
      // ── Hover pause (desktop) ──
      this.track.addEventListener('mouseenter', () => this.pause());
      this.track.addEventListener('mouseleave', () => {
        if (!this.isDragging) this.scheduleResume(600);
      });

      // ── Pointer drag (mouse + touch unified) ──
      this.track.addEventListener('pointerdown', e => this.onPointerDown(e));
      // Attach move/up to window so drag continues outside the track
      window.addEventListener('pointermove', e => this.onPointerMove(e));
      window.addEventListener('pointerup', e => this.onPointerUp(e));

      // ── Click-to-center ──
      this.track.addEventListener('click', e => this.onClickCenter(e));
    }

    // ── Pointer handlers ──

    onPointerDown(e) {
      // Only primary button
      if (e.button !== 0) return;
      this.isDragging = true;
      this.wasDragged = false;
      this.animating = false;
      this.dragStartX = e.clientX;
      this.dragStartPos = this.position;
      this.velocity = 0;
      this.pause();
      this.track.style.cursor = 'grabbing';
      this.track.setPointerCapture(e.pointerId);
    }

    onPointerMove(e) {
      if (!this.isDragging) return;
      const dx = e.clientX - this.dragStartX;
      if (Math.abs(dx) > 3) this.wasDragged = true;
      const newPos = this.dragStartPos + dx;
      this.velocity = newPos - this.position;
      this.position = newPos;
      this.normalizePosition();
      this.applyTransform();
    }

    onPointerUp(e) {
      if (!this.isDragging) return;
      this.isDragging = false;
      this.track.style.cursor = 'grab';

      // Momentum coast
      if (Math.abs(this.velocity) > 1) {
        this.coastMomentum(this.velocity);
      } else {
        this.scheduleResume(RESUME_DELAY);
      }
    }

    coastMomentum(vel) {
      const friction = 0.95;
      const coast = () => {
        vel *= friction;
        if (Math.abs(vel) < 0.3) {
          this.scheduleResume(RESUME_DELAY);
          return;
        }
        this.position += vel;
        this.normalizePosition();
        this.applyTransform();
        requestAnimationFrame(coast);
      };
      requestAnimationFrame(coast);
    }

    // ── Click to center ──

    onClickCenter(e) {
      if (this.wasDragged) return; // was a drag, not a tap

      // Don't hijack links
      if (e.target.closest('a')) return;

      const card = e.target.closest('.quote-card');
      if (!card) return;

      const cardRect = card.getBoundingClientRect();
      const trackRect = this.track.getBoundingClientRect();
      const cardCenter = cardRect.left + cardRect.width / 2;
      const trackCenter = trackRect.left + trackRect.width / 2;
      const offset = trackCenter - cardCenter;

      this.smoothScrollTo(this.position + offset);
    }

    smoothScrollTo(target) {
      this.pause();
      this.animating = true;
      const start = this.position;
      const distance = target - start;
      const duration = 400;
      const t0 = performance.now();

      const step = (now) => {
        if (!this.animating) return;
        const elapsed = now - t0;
        const progress = Math.min(elapsed / duration, 1);
        // ease-out cubic
        const eased = 1 - Math.pow(1 - progress, 3);
        this.position = start + distance * eased;
        this.normalizePosition();
        this.applyTransform();

        if (progress < 1) {
          requestAnimationFrame(step);
        } else {
          this.animating = false;
          this.scheduleResume(3000);
        }
      };
      requestAnimationFrame(step);
    }

    // ── Position helpers ──

    normalizePosition() {
      if (this.contentWidth <= 0) return;
      while (this.position > 0) this.position -= this.contentWidth;
      while (this.position < -this.contentWidth) this.position += this.contentWidth;
    }

    applyTransform() {
      this.rowEl.style.transform = `translateX(${this.position}px)`;
    }

    // ── Auto-scroll loop ──

    pause() {
      this.isPaused = true;
      if (this.resumeTimer) {
        clearTimeout(this.resumeTimer);
        this.resumeTimer = null;
      }
    }

    scheduleResume(delay) {
      if (this.resumeTimer) clearTimeout(this.resumeTimer);
      this.resumeTimer = setTimeout(() => {
        this.isPaused = false;
      }, delay);
    }

    startLoop() {
      const tick = () => {
        if (!this.isPaused && !this.isDragging && !this.animating && this.contentWidth > 0) {
          this.position += this.speed * this.direction;
          this.normalizePosition();
          this.applyTransform();
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }
  }

  // ─── Build Marquee ────────────────────────────────────

  function buildMarquee(quotes) {
    const section = document.getElementById('marquee-section');
    if (!section) return;

    section.innerHTML = '';

    if (quotes.length === 0) {
      section.innerHTML = '<div class="marquee-loading"><p>No quotes found.</p></div>';
      return;
    }

    const rows = distributeQuotes(quotes, TOTAL_ROWS);
    rows.forEach((rowQuotes, i) => {
      if (rowQuotes.length > 0) {
        new MarqueeRow(rowQuotes, i, section);
      }
    });
  }

  // ─── Init ─────────────────────────────────────────────

  async function init() {
    const quotes = await loadQuotes();
    buildMarquee(quotes);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
