const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-casuskompas-key',
};

function json(statusCode, obj) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json', ...CORS_HEADERS },
    body: JSON.stringify(obj),
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return json(405, { error: { message: 'Method not allowed' } });
  }

  const expectedSecret = process.env.CASUSKOMPAS_SHARED_SECRET;
  if (expectedSecret) {
    const headers = event.headers || {};
    const provided = headers['x-casuskompas-key'] || headers['X-Casuskompas-Key'];
    if (provided !== expectedSecret) {
      return json(401, { error: { message: 'Unauthorized' } });
    }
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { error: { message: 'Invalid JSON body' } });
  }

  const { system, messages } = body;
  if (typeof system !== 'string' || !Array.isArray(messages) || messages.length === 0) {
    return json(400, { error: { message: '"system" (string) en "messages" (niet-lege array) zijn verplicht' } });
  }

  let anthropicRes;
  try {
    anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-5',
        max_tokens: 2048,
        system,
        messages,
      }),
    });
  } catch (err) {
    return json(502, { error: { message: 'Kon Anthropic API niet bereiken: ' + err.message } });
  }

  const data = await anthropicRes.json();
  return json(anthropicRes.status, data);
};
