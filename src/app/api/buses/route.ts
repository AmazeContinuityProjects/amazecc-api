import { NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';
import defaultBuses from '@/data/dayscholar_buses.json';

/**
 * @openapi
 * /api/buses:
 *   get:
 *     tags:
 *       - Buses
 *     summary: GET endpoint for /api/buses
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       400:
 *         description: Bad Request
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal Server Error
 */

export const dynamic = 'force-dynamic';

export async function GET() {
  const fallbackBuses = (defaultBuses as any).default || defaultBuses;
  try {
    const pool = getDbPool();
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ success: true, buses: fallbackBuses });
    }

    // Try consolidated buses_v2 table first (stops + placements as JSONB)
    try {
      const { rows } = await pool.query(`
        SELECT
          route_number AS id,
          type,
          route_name AS route,
          driver_name AS "driverName",
          driver_phone AS "driverPhone",
          whatsapp_group AS "whatsappGroup",
          bus_location AS "busLocation",
          supervisor_name AS "supervisorName",
          supervisor_phone AS "supervisorPhone",
          driver_incharge_name AS "driverInchargeName",
          driver_incharge_phone AS "driverInchargePhone",
          stops,
          placements
        FROM buses_v2
        ORDER BY route_number::int
      `);

      if (rows.length > 0) {
        const buses = rows.map(b => ({
          ...b,
          boardingPoints: (b.stops || []).map((s: any) => s.stopName),
          stops: b.stops || [],
          placements: b.placements || [],
        }));
        return NextResponse.json({ success: true, buses });
      }
    } catch {
      // buses_v2 doesn't exist yet, fall through
    }

    // Fall back to bus_routes + bus_stops
    try {
      const { rows } = await pool.query(`
        SELECT
          r.route_number AS id,
          r.type,
          r.route_name AS route,
          r.driver_name AS "driverName",
          r.driver_phone AS "driverPhone",
          r.whatsapp_group AS "whatsappGroup",
          r.bus_location AS "busLocation",
          COALESCE(
            json_agg(s.stop_name ORDER BY s.stop_order) FILTER (WHERE s.stop_name IS NOT NULL),
            '[]'
          ) AS "boardingPoints"
        FROM bus_routes r
        LEFT JOIN bus_stops s ON s.route_id = r.id
        GROUP BY r.id
        ORDER BY r.route_number::int
      `);

      if (rows.length > 0) {
        const buses = rows.map(b => ({ ...b, stops: [] }));
        return NextResponse.json({ success: true, buses });
      }
    } catch {
      // bus_routes doesn't exist either, fall through
    }

    // Fall back to old buses table
    const { rows } = await pool.query('SELECT * FROM buses');

    const buses = rows.map(row => ({
      id: row.id,
      type: row.type,
      route: row.route,
      boardingPoints: row.boarding_points,
      driverPhone: row.driver_phone,
      driverName: row.driver_name,
      whatsappGroup: row.whatsapp_group,
      busLocation: row.bus_location,
      stops: [],
    }));

    if (buses.length === 0) {
      return NextResponse.json({ success: true, buses: fallbackBuses });
    }

    return NextResponse.json({ success: true, buses });
  } catch (error: any) {
    console.error('Failed to fetch buses:', error);
    return NextResponse.json({ success: true, buses: fallbackBuses, error: "Internal server error" });
  }
}
