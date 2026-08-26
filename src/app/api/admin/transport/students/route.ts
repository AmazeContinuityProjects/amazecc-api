import { NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';
import { requireAdminAuth } from '@/lib/auth';
import type { BusStudentInput } from '@/types/transport';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const auth = await requireAdminAuth(req);
  if (auth instanceof NextResponse) return auth;
  if (!auth.permissions.includes('transport') && !auth.permissions.includes('buses')) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  try {
    const pool = getDbPool();
    const body = await req.json();
    const students: BusStudentInput[] = body.students || body;

    if (!Array.isArray(students) || students.length === 0) {
      return NextResponse.json({ success: false, error: 'Expected a non-empty array of students' }, { status: 400 });
    }

    const routeNumber = students[0].routeNumber;
    if (!routeNumber) {
      return NextResponse.json({ success: false, error: 'routeNumber is required for each student' }, { status: 400 });
    }

    const { rows: route } = await pool.query('SELECT id FROM buses_v2 WHERE route_number = $1', [routeNumber]);
    if (route.length === 0) {
      return NextResponse.json({ success: false, error: 'Route not found' }, { status: 404 });
    }
    const routeId = route[0].id;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM bus_students WHERE route_id = $1', [routeId]);

      for (const s of students) {
        await client.query(
          `INSERT INTO bus_students (route_id, registration_number, application_number, destination)
           VALUES ($1, $2, $3, $4)`,
          [routeId, s.registrationNumber, s.applicationNumber || '', s.destination || '']
        );
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    return NextResponse.json({ success: true, message: `Inserted ${students.length} students for route ${routeNumber}` });
  } catch (error: unknown) {
    console.error('Failed to update students:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const auth = await requireAdminAuth(req);
  if (auth instanceof NextResponse) return auth;
  if (!auth.permissions.includes('transport') && !auth.permissions.includes('buses')) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  try {
    const pool = getDbPool();
    const url = new URL(req.url);
    const routeId = parseInt(url.searchParams.get('routeId') || '', 10);

    if (isNaN(routeId)) {
      return NextResponse.json({ success: false, error: 'routeId query parameter is required' }, { status: 400 });
    }

    const { rowCount } = await pool.query('DELETE FROM bus_students WHERE route_id = $1', [routeId]);
    return NextResponse.json({ success: true, message: `Deleted ${rowCount} students for route ${routeId}` });
  } catch (error: unknown) {
    console.error('Failed to delete students:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
