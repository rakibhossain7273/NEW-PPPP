import {
  ParseBdrisRequestBody,
  parseBdrisDocumentsWithGemini,
} from '../../lib/parseBdrisGemini.ts';

function jsonResponse(payload: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method Not Allowed' }, 405);
  }

  try {
    const body = (await req.json()) as ParseBdrisRequestBody;
    const result = await parseBdrisDocumentsWithGemini(body, process.env.GEMINI_API_KEY);
    if (result.error || !result.data) {
      return jsonResponse({ error: result.error || 'AI বিশ্লেষণে সমস্যা হয়েছে।' }, result.status);
    }
    return jsonResponse({ data: result.data }, 200);
  } catch (err: unknown) {
    console.error('Netlify parse-bdris error:', err);
    return jsonResponse(
      { error: 'অনুরোধ প্রসেস করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।' },
      500
    );
  }
}
