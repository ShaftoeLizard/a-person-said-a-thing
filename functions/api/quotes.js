// GET /api/quotes — Public: returns all approved quotes
export async function onRequestGet({ env }) {
  try {
    const { results } = await env.DB.prepare(
      'SELECT * FROM quotes ORDER BY id DESC'
    ).all();

    // Map DB column names to camelCase for the frontend
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

    return new Response(JSON.stringify(quotes), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
