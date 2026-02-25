/**
 * A Person Said a Thing — Marquee Engine
 * Loads quotes, distributes across 7 rows, builds infinite-scroll marquee
 */

(function () {
  'use strict';

  const TOTAL_ROWS = 7;

  // Different durations per row for visual depth (seconds)
  const ROW_DURATIONS = [82, 68, 90, 72, 86, 76, 94];

  /**
   * Fetch quotes from the JSON database
   */
  async function loadQuotes() {
    try {
      const response = await fetch('data/quotes.json');
      if (!response.ok) throw new Error('Failed to load quotes');
      return await response.json();
    } catch (err) {
      console.error('Error loading quotes:', err);
      return [];
    }
  }

  /**
   * Distribute quotes across N rows as evenly as possible
   */
  function distributeQuotes(quotes, numRows) {
    const rows = Array.from({ length: numRows }, () => []);
    // Shuffle quotes for variety
    const shuffled = [...quotes].sort(() => Math.random() - 0.5);
    shuffled.forEach((quote, i) => {
      rows[i % numRows].push(quote);
    });
    return rows;
  }

  /**
   * Build the HTML for a single quote card
   */
  function buildCard(quote) {
    const card = document.createElement('div');
    card.className = 'quote-card';
    card.setAttribute('data-id', quote.id);

    card.innerHTML = `
      <div class="card-main">
        <p class="quote-text">${escapeHtml(quote.text)}</p>
        <div class="card-attribution">
          <a href="${escapeHtml(quote.socialLink)}" target="_blank" rel="noopener" class="speaker-thumbnail-link" title="Learn more about ${escapeHtml(quote.speaker)}">
            <img
              src="${escapeHtml(quote.thumbnail)}"
              alt="${escapeHtml(quote.speaker)}"
              class="speaker-thumbnail"
              loading="lazy"
            />
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
          ${quote.role ? `
            <div class="detail-item">
              <span class="detail-label">Role</span>
              <span class="detail-value">${escapeHtml(quote.role)}</span>
            </div>
          ` : ''}
          ${quote.source ? `
            <div class="detail-item">
              <span class="detail-label">Source</span>
              <span class="detail-value">${escapeHtml(quote.sourceDetail || quote.source)}</span>
            </div>
          ` : ''}
          ${quote.historicalContext ? `
            <div class="detail-item">
              <span class="detail-label">Context</span>
              <span class="detail-value">${escapeHtml(quote.historicalContext)}</span>
            </div>
          ` : ''}
        </div>
      </div>
    `;

    return card;
  }

  /**
   * Build a single marquee row
   */
  function buildRow(quotes, rowIndex) {
    const track = document.createElement('div');
    track.className = 'marquee-track';

    const row = document.createElement('div');
    // Odd rows (0, 2, 4, 6) scroll left; even rows (1, 3, 5) scroll right
    const direction = rowIndex % 2 === 0 ? 'scroll-left' : 'scroll-right';
    row.className = `marquee-row ${direction}`;
    row.style.setProperty('--scroll-duration', `${ROW_DURATIONS[rowIndex]}s`);

    // Build original cards
    quotes.forEach(quote => {
      row.appendChild(buildCard(quote));
    });

    // Clone all cards for seamless infinite scroll
    quotes.forEach(quote => {
      row.appendChild(buildCard(quote));
    });

    track.appendChild(row);
    return track;
  }

  /**
   * Build the entire marquee
   */
  function buildMarquee(quotes) {
    const section = document.getElementById('marquee-section');
    if (!section) return;

    // Clear loading state
    section.innerHTML = '';

    if (quotes.length === 0) {
      section.innerHTML = '<div class="marquee-loading"><p>No quotes found.</p></div>';
      return;
    }

    const rows = distributeQuotes(quotes, TOTAL_ROWS);

    rows.forEach((rowQuotes, index) => {
      if (rowQuotes.length > 0) {
        section.appendChild(buildRow(rowQuotes, index));
      }
    });
  }

  /**
   * Simple HTML escaping
   */
  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /**
   * Initialize
   */
  async function init() {
    const quotes = await loadQuotes();
    buildMarquee(quotes);
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
