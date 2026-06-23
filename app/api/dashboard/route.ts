import { NextResponse } from 'next/server';
import { dashboardData } from '@/lib/data';

export async function GET() {
  return NextResponse.json(dashboardData);
}
