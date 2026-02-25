// POST /api/upload/thumbnail — upload a speaker thumbnail image to R2
export async function onRequestPost({ request, env }) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return new Response(JSON.stringify({ error: 'No file provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      return new Response(JSON.stringify({ error: 'Invalid file type. Use JPEG, PNG, WebP, or GIF.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Max 2MB
    if (file.size > 2 * 1024 * 1024) {
      return new Response(JSON.stringify({ error: 'File too large. Maximum 2MB.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Generate unique filename
    const ext = file.name.split('.').pop() || 'jpg';
    const key = `thumbnails/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    // Upload to R2
    await env.BUCKET.put(key, file.stream(), {
      httpMetadata: { contentType: file.type },
    });

    // Return the public URL (R2 custom domain or public bucket URL)
    const publicUrl = `${new URL(request.url).origin}/cdn/${key}`;

    return new Response(JSON.stringify({ success: true, url: publicUrl, key }), {
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
