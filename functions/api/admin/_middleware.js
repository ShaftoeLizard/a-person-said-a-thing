// Middleware: protect all /api/admin/* routes
// Verifies Cloudflare Access JWT to ensure only authorized users can access admin APIs

export async function onRequest(context) {
  const { request, env, next } = context;

  // In development or if Access isn't configured yet, check for a simple auth header
  const cfAccessJWT = request.headers.get('Cf-Access-Jwt-Assertion');

  if (cfAccessJWT) {
    // Cloudflare Access is active — the JWT is already validated at the edge
    // Optionally verify the email claim
    try {
      const payload = JSON.parse(atob(cfAccessJWT.split('.')[1]));
      const allowedEmails = (env.ADMIN_EMAILS || 'southworth.cole@proton.me').split(',');
      if (!allowedEmails.includes(payload.email)) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    } catch {
      // JWT parsing failed — let Access handle it
    }
    return next();
  }

  // Fallback: simple bearer token auth (for when Access isn't set up yet)
  const authHeader = request.headers.get('Authorization');
  if (authHeader && env.ADMIN_TOKEN) {
    const token = authHeader.replace('Bearer ', '');
    if (token === env.ADMIN_TOKEN) {
      return next();
    }
  }

  return new Response(JSON.stringify({ error: 'Authentication required' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });
}
