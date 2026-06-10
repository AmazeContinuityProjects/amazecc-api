import { NextResponse } from "next/server";
import VTOPClient from "@/lib/clients/VTOPClient";
import { RequestBody } from "@/types/custom";
import { hostel, leaveItem } from "@/types/data/hostel";
import * as cheerio from "cheerio";
import { URLSearchParams } from "url";






/**
 * @openapi
 * /api/hostel:
 *   post:
 *     tags:
 *       - Hostel
 *     summary: POST endpoint for /api/hostel
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               cookies:
 *                 type: string
 *               authorizedID:
 *                 type: string
 *               csrf:
 *                 type: string
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

export async function POST(req: Request) {
    try {
        const {  cookies, authorizedID, csrf  } = await req.json().catch(()=>({}));

        const cookieHeader = Array.isArray(cookies) ? cookies.join("; ") : cookies;
        if (!csrf || !authorizedID) {
            throw new Error("Cannot find _csrf or authorizedID");
        }

        const client = VTOPClient();

        const hostelRes = await client.post(
            "/vtop/studentsRecord/StudentProfileAllView",
            new URLSearchParams({
                verifyMenu: "true",
                authorizedID,
                _csrf: csrf,
                nocache: Date.now().toString(),
            }).toString(),
            {
                headers: {
                    Cookie: cookieHeader,
                    "Content-Type": "application/x-www-form-urlencoded",
                    Referer: "https://vtopcc.vit.ac.in/vtop/open/page",
                },
            }
        );

        await client.post(
            "/vtop/hostels/student/leave/1",
            new URLSearchParams({
                verifyMenu: "true",
                authorizedID,
                _csrf: csrf,
                nocache: Date.now().toString(),
            }).toString(),
            {
                headers: {
                    Cookie: cookieHeader,
                    "Content-Type": "application/x-www-form-urlencoded",
                    Referer: "https://vtopcc.vit.ac.in/vtop/open/page",
                },
            }
        );

        const leaveRes = await client.post(
            "/vtop/hostels/student/leave/6",
            new URLSearchParams({
                history: "",
                authorizedID,
                _csrf: csrf,
                form: "undefined",
                control: "history",
                x: Date.now().toString(),
            }).toString(),
            {
                headers: {
                    Cookie: cookieHeader,
                    "Content-Type": "application/x-www-form-urlencoded",
                    Referer: "https://vtopcc.vit.ac.in/vtop/hostels/student/leave/1",
                },
            }
        );

        const activeLeaveRes = await client.post(
            "/vtop/hostels/student/leave/4",
            new URLSearchParams({
                status: "",
                authorizedID,
                _csrf: csrf,
                form: "undefined",
                control: "status",
                x: Date.now().toString(),
            }).toString(),
            {
                headers: {
                    Cookie: cookieHeader,
                    "Content-Type": "application/x-www-form-urlencoded",
                    Referer: "https://vtopcc.vit.ac.in/vtop/hostels/student/leave/1",
                },
            }
        );

        const $$ = cheerio.load(hostelRes.data);
        const $$$ = cheerio.load(leaveRes.data);
        const $$$_ = cheerio.load(activeLeaveRes.data);
        const leaveRows = $$$("#LeaveHistoryTable tbody tr");
        const appliedLeaveRows = $$$_("#LeaveAppliedTable tbody tr");

        let hostelInfo: hostel = {};

        $$("table tr").each((_, row) => {
            const cols = $$(row).find("td");
            if (cols.length < 2) return;

            const label = cols.eq(0).text().trim();
            const value = cols.eq(1).text().trim();

            if (label.includes("GENDER")) {
                hostelInfo.gender = value;
            } else if (label.includes("HOSTELLER")) {
                hostelInfo.isHosteller = value === "HOSTELLER";
            }

            if (label.includes("Block Name")) {
                hostelInfo.blockName = value.split(" ")[0] || "NOT ALLOTED";
            } else if (label.includes("Room No")) {
                hostelInfo.roomNo = value;
            } else if (label.includes("Mess Information")) {
                hostelInfo.messInfo = value.split(" ")[0] || "NOT ALLOTED";
                if (hostelInfo.messInfo.length > 7) {
                    if (hostelInfo.messInfo === "NON") hostelInfo.messInfo = "NON VEG";
                    else if (hostelInfo.messInfo === "FOOD") hostelInfo.messInfo = "FOOD PARK";
                    else hostelInfo.messInfo = "NOT ALLOTED";
                }
            }
        });

        const leaveMap = new Map<string, leaveItem>();
        leaveRows.each((_, row) => {
            const cells = $$$(row).find("td");

            if (cells.length >= 8) {
                const leave: leaveItem = {
                    leaveId: $$$(cells[1]).text().trim(),
                    visitPlace: $$$(cells[2]).text().trim(),
                    reason: $$$(cells[3]).text().trim(),
                    leaveType: $$$(cells[4]).text().trim(),
                    from: $$$(cells[5]).text().trim(),
                    to: $$$(cells[6]).text().trim(),
                    status: $$$(cells[7]).text().trim(),
                    remarks: $$$(cells[8]).text().trim(),
                };

                leaveMap.set(leave.leaveId, leave);
            }
        });
        appliedLeaveRows.each((_, row) => {
            const cells = $$$_(row).find("td");

            if (cells.length >= 9) {
                const leave: leaveItem = {
                    leaveId: $$$_(cells[2]).text().trim(),
                    visitPlace: $$$_(cells[3]).text().trim(),
                    reason: $$$_(cells[4]).text().trim(),
                    leaveType: $$$_(cells[5]).text().trim(),
                    from: $$$_(cells[6]).text().trim(),
                    to: $$$_(cells[7]).text().trim(),
                    status: $$$_(cells[8]).text().trim(),
                    remarks: $$$_(cells[9]).text().trim(),
                };

                leaveMap.set(leave.leaveId, leave);
            }
        });
        const leaveHistory = Array.from(leaveMap.values());

        return NextResponse.json({ hostelInfo, leaveHistory }, { status: 200 });
    } catch (err: any) {
        console.error(err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}


