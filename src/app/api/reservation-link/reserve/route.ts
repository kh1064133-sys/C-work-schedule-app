import { NextResponse } from 'next/server';

export const dynamic = 'force-static';

export async function GET() {
	return NextResponse.json(
		{ error: '예약 링크 처리 API가 현재 비활성화되어 있습니다.' },
		{ status: 410 },
	);
}

