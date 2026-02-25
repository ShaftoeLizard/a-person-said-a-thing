// Admin: manage proposals
// Protected by Cloudflare Access (configured in dashboard)

// GET /api/admin/proposals — list pending proposals
export async function onRequestGet({ env }) {
  try {
    const { results } = await env.DB.prepare(
      'SELECT * FROM proposals WHERE status = ? ORDER BY created_at DESC'
    ).bind('pending').all();

    return new Response(JSON.stringify(results), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// POST /api/admin/proposals — approve or reject a proposal
export async function onRequestPost({ request, env }) {
  try {
    const { id, action, edits } = await request.json();

    if (!id || !['approve', 'reject'].includes(action)) {
      return new Response(JSON.stringify({ error: 'Invalid request: need id and action (approve|reject)' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (action === 'reject') {
      await env.DB.prepare(
        'UPDATE proposals SET status = ?, reviewed_at = datetime(?) WHERE id = ?'
      ).bind('rejected', new Date().toISOString(), id).run();

      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Approve: fetch the proposal, optionally apply edits, insert into quotes
    const proposal = await env.DB.prepare('SELECT * FROM proposals WHERE id = ?').bind(id).first();
    if (!proposal) {
      return new Response(JSON.stringify({ error: 'Proposal not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Merge any admin edits on top of proposal data
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

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
