import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

const API_KEY = process.env.SOLAPI_API_KEY || '';
const API_SECRET = process.env.SOLAPI_API_SECRET || '';

function getAuthHeader() {
  const date = new Date().toISOString();
  const salt = crypto.randomBytes(32).toString('hex');
  const signature = crypto.createHmac('sha256', API_SECRET).update(date + salt).digest('hex');
  return `HMAC-SHA256 apiKey=${API_KEY}, date=${date}, salt=${salt}, signature=${signature}`;
}

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json() as {
      messages: { to: string; from: string; text: string }[];
    };

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'messages 배열이 필요합니다' }, { status: 400 });
    }

    // Solapi send-many API
    const body = {
      messages: messages.map(m => ({
        to: m.to.replace(/-/g, ''),
        from: m.from.replace(/-/g, ''),
        text: m.text,
        type: m.text.length > 90 ? 'LMS' : 'SMS',
      })),
    };

    const res = await fetch('https://api.solapi.com/messages/v4/send-many', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: getAuthHeader(),
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json({ error: data }, { status: res.status });
    }

    return NextResponse.json(data);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
