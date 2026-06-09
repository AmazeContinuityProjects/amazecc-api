import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";

/**
 * @swagger
 * /api/stats:
 *   get:
 *     tags:
 *       - System
 *     summary: Get API Usage Statistics
 *     description: Returns an HTML page containing charts for API usage statistics.
 *     parameters:
 *       - in: query
 *         name: range
 *         schema:
 *           type: string
 *           enum: [24h, 7d, 30d, full]
 *           default: 30d
 *         description: The time range for the statistics.
 *     responses:
 *       200:
 *         description: HTML page with statistics charts
 *         content:
 *           text/html:
 *             schema:
 *               type: string
 *       500:
 *         description: Internal server error
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 */
/**
 * @openapi
 * /api/stats:
 *   get:
 *     tags:
 *       - Stats
 *     summary: GET endpoint for /api/stats
 *     parameters:
 *       - name: range
 *         in: query
 *         required: false
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Successful response
 */

export async function GET(req: Request) {
  try {
    const range = new URL(req.url).searchParams.get("range") || "30d";
    let dateFilter = "";
    
    switch (range) {
      case "24h":
        dateFilter = "created_at >= NOW() - INTERVAL '24 HOURS'";
        break;
      case "7d":
        dateFilter = "created_at >= NOW() - INTERVAL '7 DAYS'";
        break;
      case "30d":
        dateFilter = "created_at >= NOW() - INTERVAL '30 DAYS'";
        break;
      case "full":
      default:
        dateFilter = "1=1";
        break;
    }

    const pool = getDbPool();

    // 1. Hourly Data
    const hourlyRes = await pool.query(`
      SELECT 
        to_char(created_at + INTERVAL '5 hours 30 minutes', 'YYYY-MM-DD HH24:00') as hour, 
        COUNT(id) as count 
      FROM api_route_logs 
      WHERE ${dateFilter} 
      GROUP BY hour 
      ORDER BY hour ASC
    `);
    const hourlyData = hourlyRes.rows;
    const hourLabels = hourlyData.map((d: any) => d.hour);
    const hourCounts = hourlyData.map((d: any) => Number(d.count));

    // 2. Route Hourly Data
    const routeRes = await pool.query(`
      SELECT 
        to_char(created_at + INTERVAL '5 hours 30 minutes', 'YYYY-MM-DD HH24:00') as hour, 
        route, 
        COUNT(id) as count 
      FROM api_route_logs 
      WHERE ${dateFilter} 
      GROUP BY hour, route 
      ORDER BY hour ASC
    `);
    const routeHourlyData = routeRes.rows;

    // 3. Source Hourly Data
    const sourceRes = await pool.query(`
      SELECT 
        to_char(created_at + INTERVAL '5 hours 30 minutes', 'YYYY-MM-DD HH24:00') as hour, 
        source, 
        COUNT(id) as count 
      FROM api_route_logs 
      WHERE ${dateFilter} 
      GROUP BY hour, source 
      ORDER BY hour ASC
    `);
    const sourceHourlyData = sourceRes.rows;

    // 4. Global First Seen
    const firstSeenRes = await pool.query(`
      SELECT 
        COALESCE(hashed_ip, 'unknown') as "user", 
        to_char(MIN(created_at) + INTERVAL '5 hours 30 minutes', 'YYYY-MM-DD HH24:00') as "firstHour"
      FROM visitor_logs 
      GROUP BY "user"
    `);
    const firstSeenHourPerUser = new Map<string, string>();
    firstSeenRes.rows.forEach((row: any) => {
      firstSeenHourPerUser.set(row.user, row.firstHour);
    });

    // 5. Unique Users Hourly
    const uniqueUsersRes = await pool.query(`
      SELECT 
        to_char(created_at + INTERVAL '5 hours 30 minutes', 'YYYY-MM-DD HH24:00') as hour, 
        COUNT(DISTINCT COALESCE(hashed_ip, 'unknown')) as "uniqueUsers"
      FROM visitor_logs 
      WHERE ${dateFilter} 
      GROUP BY hour 
      ORDER BY hour ASC
    `);
    const uniqueUsersHourly = uniqueUsersRes.rows;

    // Raw records for returning users calculation
    const visitorRecordsRes = await pool.query(`
      SELECT 
        to_char(created_at + INTERVAL '5 hours 30 minutes', 'YYYY-MM-DD HH24:00') as hour, 
        COALESCE(hashed_ip, 'unknown') as "user"
      FROM visitor_logs 
      WHERE ${dateFilter}
    `);
    
    // Process returning vs new users
    const userHourlyGroups = new Map<string, Set<string>>();
    visitorRecordsRes.rows.forEach((row: any) => {
        if (!userHourlyGroups.has(row.hour)) {
            userHourlyGroups.set(row.hour, new Set());
        }
        userHourlyGroups.get(row.hour)?.add(row.user);
    });

    const returningUserCounts: any[] = [];
    uniqueUsersHourly.forEach((row: any) => {
        const hour = row.hour;
        const usersInHour = userHourlyGroups.get(hour) || new Set();
        let newCount = 0;
        let returningCount = 0;

        for (const u of usersInHour) {
            if (firstSeenHourPerUser.get(u) === hour) {
                newCount++;
            } else {
                returningCount++;
            }
        }
        returningUserCounts.push(returningCount);
    });

    const uniqueUserCounts = uniqueUsersHourly.map((d: any) => Number(d.uniqueUsers));
    const sortedHours = uniqueUsersHourly.map((d: any) => d.hour);

    const sourceHours = [...new Set(sourceHourlyData.map((d: any) => d.hour))].sort();
    const sources = [...new Set(sourceHourlyData.map((d: any) => d.source || "unknown"))];

const allHours = [...new Set(routeHourlyData.map((d: any) => d.hour))].sort();

    const routes = routeRes.rows.map((r: any) => r.route);

    const routeDatasets = routes.map((route, index) => {
      const colors = [
        'rgb(75, 192, 192)',
        'rgb(255, 99, 132)',
        'rgb(54, 162, 235)',
        'rgb(255, 206, 86)',
        'rgb(153, 102, 255)',
        'rgb(255, 159, 64)',
        'rgb(199, 199, 199)',
        'rgb(83, 102, 255)',
        'rgb(255, 99, 255)',
        'rgb(99, 255, 132)',
      ];

      const color = colors[index % colors.length] || 'rgb(100, 100, 100)';

      const data = allHours.map(hour => {
        const entry: any = routeHourlyData.find(
          (d: any) => d.hour === hour && d.route === route
        );
        return entry ? Number(entry.count) : 0;
      });

      return {
        label: route,
        data: data,
        borderColor: color,
        backgroundColor: color.replace('rgb', 'rgba').replace(')', ', 0.1)'),
        borderWidth: 2,
        tension: 0.3,
        fill: false
      };
    });

    const sourceDatasets = sources.map((source, index) => {
      const colors = [
        'rgb(153, 102, 255)',
        'rgb(255, 159, 64)',
        'rgb(75, 192, 192)',
        'rgb(255, 99, 132)',
        'rgb(54, 162, 235)'
      ];
      const color = colors[index % colors.length] || 'rgb(100, 100, 100)';
      
      const data = sourceHours.map(hour => {
        const entry: any = sourceHourlyData.find(
          (d: any) => d.hour === hour && (d.source || "unknown") === source
        );
        return entry ? Number(entry.count) : 0;
      });

      return {
        label: source,
        data: data,
        borderColor: color,
        backgroundColor: color.replace('rgb', 'rgba').replace(')', ', 0.1)'),
        borderWidth: 2,
        tension: 0.3,
        fill: false
      };
    });

    return new NextResponse(`
<!DOCTYPE html>
<html>
<head>
  <title>API Usage Stats</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
  :root {
    --bg: #0f1115;
    --card: #151821;
    --border: #2a2f3a;
    --text-primary: #e5e7eb;
    --text-secondary: #9ca3af;
    --accent: #38bdf8;
  }

  body {
    font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
    padding: 20px;
    background: var(--bg);
    color: var(--text-primary);
  }

  .container {
    max-width: 1400px;
    margin: 0 auto;
    background: var(--card);
    padding: 30px;
    border-radius: 12px;
    border: 1px solid var(--border);
    height: fit-content;
  }

  h1 {
    color: var(--text-primary);
    margin-bottom: 30px;
  }

  h2 {
    color: var(--text-secondary);
    margin-top: 40px;
    margin-bottom: 20px;
    font-weight: 500;
  }

  .chart-container {
    position: relative;
    height: 400px;
    margin-bottom: 50px;
    background: #11141b;
    border-radius: 10px;
    padding: 16px;
    border: 1px solid var(--border);
  }

  canvas {
    max-width: 100%;
  }

  .range-btn {
  background: #11141b;
  color: var(--text-secondary);
  border: 1px solid var(--border);
  padding: 8px 14px;
  border-radius: 8px;
  cursor: pointer;
}

  .range-btn:hover {
    color: var(--text-primary);
    border-color: var(--accent);
  }

  .range-btn.active {
    background: var(--accent);
    color: #000;
    border-color: var(--accent);
  }

</style>
</head>
<body>
  <div class="container">
    <div style="display:flex; gap:12px; margin-bottom:20px;">
      <button class="range-btn" data-range="24h">Last 24 Hours</button>
      <button class="range-btn" data-range="7d">Last 7 Days</button>
      <button class="range-btn" data-range="30d">Last 30 Days</button>
      <button class="range-btn" data-range="full">To Date</button>
    </div>

    <h2>Total Requests Per Hour</h2>
    <div class="chart-container">
      <canvas id="hourChart"></canvas>
    </div>
    
    <h2>Requests Per Route Per Hour</h2>
    <div class="chart-container" style="height: 500px;">
      <canvas id="routeHourChart"></canvas>
    </div>
    <h2>Requests by Source Domain</h2>
    <div class="chart-container" style="height: 500px;">
      <canvas id="sourceChart"></canvas>
    </div>
    <h2>Users Over Time</h2>
    <div class="chart-container" style="height: 500px;">
      <canvas id="userChart"></canvas>
    </div>
</div>

  </div>
  
  <script>
  Chart.defaults.color = "#9ca3af";
  Chart.defaults.borderColor = "#2a2f3a";
  Chart.defaults.font.family =
    "system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  </script>
  <script>
    new Chart(document.getElementById("hourChart"), {
      type: "line",
      data: {
        labels: ${JSON.stringify(hourLabels)},
        datasets: [{
          label: "Total Requests",
          data: ${JSON.stringify(hourCounts)},
          borderColor: "rgb(75, 192, 192)",
          backgroundColor: "rgba(75, 192, 192, 0.2)",
          borderWidth: 2,
          tension: 0.3,
          fill: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true
          },
          tooltip: {
            mode: 'index',
            intersect: false
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              precision: 0
            }
          }
        }
      }
    });
    
    new Chart(document.getElementById("routeHourChart"), {
      type: "line",
      data: {
        labels: ${JSON.stringify(allHours)},
        datasets: ${JSON.stringify(routeDatasets)}
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'right'
          },
          tooltip: {
            mode: 'index',
            intersect: false
          }
        },
        interaction: {
          mode: 'nearest',
          axis: 'x',
          intersect: false
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              precision: 0
            }
          },
          x: {
            ticks: {
              maxRotation: 45,
              minRotation: 45
            }
          }
        }
      }
    });

new Chart(document.getElementById("sourceChart"), {
  type: "line",
  data: {
    labels: ${JSON.stringify(sourceHours)},
    datasets: ${JSON.stringify(sourceDatasets)}
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: "right"
      },
      tooltip: {
        mode: "index",
        intersect: false
      }
    },
    interaction: {
      mode: "nearest",
      axis: "x",
      intersect: false
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          precision: 0
        }
      },
      x: {
        ticks: {
          maxRotation: 45,
          minRotation: 45
        }
      }
    }
  }
});
  </script>
  <script>
    const params = new URLSearchParams(window.location.search);
    const currentRange = params.get("range") || "30d";

    document.querySelectorAll(".range-btn").forEach(btn => {
      if (btn.dataset.range === currentRange) {
        btn.classList.add("active");
      }

      btn.addEventListener("click", () => {
        params.set("range", btn.dataset.range);
        window.location.search = params.toString();
      });
    });
  </script>
    <script>
  new Chart(document.getElementById("userChart"), {
    type: "line",
    data: {
      labels: ${JSON.stringify(sortedHours)},
      datasets: [
        {
          label: "Unique Users",
          data: ${JSON.stringify(uniqueUserCounts)},
          borderColor: "rgb(54, 162, 235)",
          backgroundColor: "rgba(54, 162, 235, 0.2)",
          borderWidth: 2,
          tension: 0.3,
          fill: true,
        },
        {
          label: "Returning Users",
          data: ${JSON.stringify(returningUserCounts)},
          borderColor: "rgb(255, 99, 132)",
          backgroundColor: "rgba(255, 99, 132, 0.2)",
          borderWidth: 2,
          tension: 0.3,
          fill: true,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true },
        tooltip: {
          mode: "index",
          intersect: false
        }
      },
      interaction: {
        mode: "nearest",
        axis: "x",
        intersect: false
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { precision: 0 }
        }
      }
    }
  });
  </script>
</body>
</html>
`, { headers: { "Content-Type": "text/html" } });
  } catch (error) {
    console.error("Stats error:", error);
    return new NextResponse("Error generating stats", { status: 500 });
  }
}

