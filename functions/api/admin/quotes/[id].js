// Admin: edit or delete a specific quote
// Protected by Cloudflare Access

// PUT /api/admin/quotes/:id — update a quote
export async function onRequestPut({ params, request, env }) {
  try {
    const id = params.id;
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

    if (fields.length === 0) {
      return new Response(JSON.stringify({ error: 'No fields to update' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    fields.push('updated_at = datetime(?)');
    values.push(new Date().toISOString());
    values.push(id);

    await env.DB.prepare(
      `UPDATE quotes SET ${fields.join(', ')} WHERE id = ?`
    ).bind(...values).run();

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

// DELETE /api/admin/quotes/:id — remove a quote
export async function onRequestDelete({ params, env }) {
  try {
    await env.DB.prepare('DELETE FROM quotes WHERE id = ?').bind(params.id).run();
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
