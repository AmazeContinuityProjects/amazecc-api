import { parseDocument } from "htmlparser2";
import { selectAll } from "css-select";
import { textContent } from "domutils";
import type { AnyNode, Element } from "domhandler";
import VTOPClient from "@/lib/clients/VTOPClient";
import { URLSearchParams } from "url";
import { courseItem } from "@/types/data/attendance";

function textOf(node: AnyNode | undefined | null): string {
    return node ? textContent(node).replace(/\r\n/g, "\n").trim() : "";
}

function getCells(row: AnyNode): Element[] {
    return selectAll("td", row) as Element[];
}

export function parseTimetableHtml(html: string): courseItem[] {
    const doc = parseDocument(html);
    const courseInfo: courseItem[] = [];

    const tables = selectAll("table.table", doc);
    for (const table of tables) {
        const rows = selectAll("tr", table);
        for (const row of rows) {
            const cells = getCells(row);
            if (cells.length === 0) continue;

            const slotVenueCell = textOf(cells[7]);
            const courseCell = textOf(cells[2]);
            const isLab = slotVenueCell.startsWith("L");
            const courseCodeBase = courseCell.split(" ")[0] || "";

            courseInfo.push({
                slNo: textOf(cells[0]),
                course: courseCell,
                courseCode: isLab ? courseCodeBase + "(L)" : courseCodeBase + "(T)",
                LTPJC: textOf(cells[3]),
                category: textOf(cells[4]),
                classId: textOf(cells[6]),
                slotVenue: slotVenueCell,
                facultyDetails: textOf(cells[8]),
            });
        }
    }

    return courseInfo;
}

export default async function fetchTimetable(
    cookieHeader: string | string[],
    authorizedID: string,
    csrf: string,
    semesterId: string
): Promise<courseItem[]> {
    const client = VTOPClient();
    const ttRes = await client.post(
        "/vtop/processViewTimeTable",
        new URLSearchParams({
            authorizedID,
            semesterSubId: semesterId,
            _csrf: csrf,
            x: Date.now().toString(),
        }).toString(),
        {
            headers: {
                Cookie: cookieHeader,
                "Content-Type": "application/x-www-form-urlencoded",
                Referer: "https://vtopcc.vit.ac.in/vtop/open/page",
            },
        }
    );

    return parseTimetableHtml(ttRes.data);
}
