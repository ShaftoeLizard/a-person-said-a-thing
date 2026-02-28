/**
 * A Person Said a Thing — Cloudflare Worker
 * Handles API routes; static assets served automatically
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // ─── API Routes ────────────────────────────────────
    if (url.pathname.startsWith('/api/')) {
      return handleAPI(request, env, url);
    }

    // ─── Static assets (HTML, CSS, JS, images) ────────
    return env.ASSETS.fetch(request);
  },
};

// ─── API Router ──────────────────────────────────────────

async function handleAPI(request, env, url) {
  const method = request.method;
  const path = url.pathname;

  try {
    // Public: GET /api/quotes
    if (path === '/api/quotes' && method === 'GET') {
      return getQuotes(env);
    }

    // Public: POST /api/proposals
    if (path === '/api/proposals' && method === 'POST') {
      return createProposal(request, env);
    }

    // Public: POST /api/upload/thumbnail
    if (path === '/api/upload/thumbnail' && method === 'POST') {
      return uploadThumbnail(request, env);
    }

    // ── Admin routes (auth required) ──
    if (path.startsWith('/api/admin/')) {
      const authResult = checkAuth(request, env);
      if (authResult) return authResult;

      // GET /api/admin/proposals
      if (path === '/api/admin/proposals' && method === 'GET') {
        return getProposals(env);
      }

      // POST /api/admin/proposals (approve/reject)
      if (path === '/api/admin/proposals' && method === 'POST') {
        return reviewProposal(request, env);
      }

      // PUT /api/admin/quotes/:id
      const quoteMatch = path.match(/^\/api\/admin\/quotes\/(\d+)$/);
      if (quoteMatch && method === 'PUT') {
        return updateQuote(quoteMatch[1], request, env);
      }

      // DELETE /api/admin/quotes/:id
      if (quoteMatch && method === 'DELETE') {
        return deleteQuote(quoteMatch[1], env);
      }

      // PUT /api/admin/quotes/new (add new)
      if (path === '/api/admin/quotes/new' && method === 'PUT') {
        return addQuote(request, env);
      }
    }

    return json({ error: 'Not found' }, 404);
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

// ─── Auth ────────────────────────────────────────────────

function checkAuth(request, env) {
  // Cloudflare Access (Zero Trust) — JWT verification
  const jwt = request.headers.get('Cf-Access-Jwt-Assertion');
  if (jwt) {
    try {
      const payload = JSON.parse(atob(jwt.split('.')[1]));
      const allowed = (env.ADMIN_EMAILS || 'southworth.cole@proton.me').split(',');
      if (allowed.includes(payload.email)) {
        return null; // authorized
      }
    } catch {
      // JWT parsing failed
    }
  }

  return json({ error: 'Authentication required' }, 401);
}

// ─── Handlers ────────────────────────────────────────────

async function getQuotes(env) {
  const { results } = await env.DB.prepare(
    'SELECT * FROM quotes ORDER BY id DESC'
  ).all();

  const quotes = results.map(row => ({
    id: row.id,
    text: row.text,
    speaker: row.speaker,
    date: row.date,
    thumbnail: row.thumbnail || `https://ui-avatars.com/api/?name=${encodeURIComponent(row.speaker)}&background=CC785C&color=fff&size=80&rounded=true`,
    socialLink: row.social_link,
    role: row.role,
    source: row.source,
    sourceDetail: row.source_detail,
    historicalContext: row.historical_context,
  }));

  return json(quotes);
}

async function createProposal(request, env) {
  const body = await request.json();
  const required = ['text', 'speaker', 'date', 'source', 'submitterName', 'submitterSocial'];
  for (const field of required) {
    if (!body[field] || !body[field].trim()) {
      return json({ error: `Missing required field: ${field}` }, 400);
    }
  }

  await env.DB.prepare(
    `INSERT INTO proposals (text, speaker, date, thumbnail, social_link, role, source, source_detail, historical_context, submitter_name, submitter_social)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    body.text.trim(), body.speaker.trim(), body.date.trim(),
    body.thumbnail || null, body.socialLink || null, body.role || null,
    body.source.trim(), body.sourceDetail || null, body.historicalContext || null,
    body.submitterName.trim(), body.submitterSocial.trim()
  ).run();

  return json({ success: true }, 201);
}

async function getProposals(env) {
  const { results } = await env.DB.prepare(
    'SELECT * FROM proposals WHERE status = ? ORDER BY created_at DESC'
  ).bind('pending').all();
  return json(results);
}

async function reviewProposal(request, env) {
  const { id, action, edits } = await request.json();
  if (!id || !['approve', 'reject'].includes(action)) {
    return json({ error: 'Need id and action (approve|reject)' }, 400);
  }

  if (action === 'reject') {
    await env.DB.prepare(
      'UPDATE proposals SET status = ?, reviewed_at = datetime(?) WHERE id = ?'
    ).bind('rejected', new Date().toISOString(), id).run();
    return json({ success: true });
  }

  // Approve: copy to quotes table
  const proposal = await env.DB.prepare('SELECT * FROM proposals WHERE id = ?').bind(id).first();
  if (!proposal) return json({ error: 'Not found' }, 404);

  const data = { ...proposal, ...(edits || {}) };
  await env.DB.prepare(
    `INSERT INTO quotes (text, speaker, date, thumbnail, social_link, role, source, source_detail, historical_context)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    data.text, data.speaker, data.date, data.thumbnail,
    data.social_link, data.role, data.source, data.source_detail,
    data.historical_context
  ).run();

  await env.DB.prepare(
    'UPDATE proposals SET status = ?, reviewed_at = datetime(?) WHERE id = ?'
  ).bind('approved', new Date().toISOString(), id).run();

  return json({ success: true });
}

async function updateQuote(id, request, env) {
  const body = await request.json();
  const fields = [];
  const values = [];
  const allowed = ['text', 'speaker', 'date', 'thumbnail', 'social_link', 'role', 'source', 'source_detail', 'historical_context'];

  for (const key of allowed) {
    if (body[key] !== undefined) {
      fields.push(`${key} = ?`);
      values.push(body[key]);
    }
  }
  if (fields.length === 0) return json({ error: 'No fields to update' }, 400);

  fields.push('updated_at = datetime(?)');
  values.push(new Date().toISOString());
  values.push(id);

  await env.DB.prepare(`UPDATE quotes SET ${fields.join(', ')} WHERE id = ?`).bind(...values).run();
  return json({ success: true });
}

async function addQuote(request, env) {
  const body = await request.json();
  await env.DB.prepare(
    `INSERT INTO quotes (text, speaker, date, thumbnail, social_link, role, source, source_detail, historical_context)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    body.text, body.speaker, body.date || null, body.thumbnail || null,
    body.social_link || null, body.role || null, body.source || null,
    body.source_detail || null, body.historical_context || null
  ).run();
  return json({ success: true }, 201);
}

async function deleteQuote(id, env) {
  await env.DB.prepare('DELETE FROM quotes WHERE id = ?').bind(id).run();
  return json({ success: true });
}

async function uploadThumbnail(request, env) {
  if (!env.BUCKET) return json({ error: 'R2 not configured yet' }, 501);

  const formData = await request.formData();
  const file = formData.get('file');
  if (!file) return json({ error: 'No file provided' }, 400);

  const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!validTypes.includes(file.type)) return json({ error: 'Invalid file type' }, 400);
  if (file.size > 2 * 1024 * 1024) return json({ error: 'File too large (max 2MB)' }, 400);

  const ext = file.name.split('.').pop() || 'jpg';
  const key = `thumbnails/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  await env.BUCKET.put(key, file.stream(), {
    httpMetadata: { contentType: file.type },
  });

  return json({ success: true, url: `/cdn/${key}`, key }, 201);
}

// ─── Helpers ─────────────────────────────────────────────

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
