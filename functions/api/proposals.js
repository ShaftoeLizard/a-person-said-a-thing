// POST /api/proposals — Public: submit a new quote proposal
export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();

    // Validate required fields
    const required = ['text', 'speaker', 'date', 'source', 'submitterName', 'submitterSocial'];
    for (const field of required) {
      if (!body[field] || !body[field].trim()) {
        return new Response(JSON.stringify({ error: `Missing required field: ${field}` }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    await env.DB.prepare(
      `INSERT INTO proposals (text, speaker, date, thumbnail, social_link, role, source, source_detail, historical_context, submitter_name, submitter_social)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      body.text.trim(),
      body.speaker.trim(),
      body.date.trim(),
      body.thumbnail || null,
      body.socialLink || null,
      body.role || null,
      body.source.trim(),
      body.sourceDetail || null,
      body.historicalContext || null,
      body.submitterName.trim(),
      body.submitterSocial.trim()
    ).run();

    return new Response(JSON.stringify({ success: true }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
