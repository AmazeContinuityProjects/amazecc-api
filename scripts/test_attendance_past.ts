import VTOPClient from "./src/lib/clients/VTOPClient";
import * as cheerio from "cheerio";
import { config } from "dotenv";
config();

async function run() {
    const username = process.env.VTOP_USERNAME!;
    const password = process.env.VTOP_PASSWORD!;
    
    // Use localhost API to login
    const loginResp = await fetch("http://localhost:3000/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
    });
    const loginData = await loginResp.json();
    
    const client = VTOPClient();
    const headers = { Cookie: loginData.cookies.join("; ") };
    
    // CH2024251 (Fall Semester 2024-25, a past semester)
    const semSubId = "CH2024251"; 
    
    const resp = await client.post(
        "/vtop/processViewStudentAttendance",
        new URLSearchParams({
            authorizedID: loginData.authorizedID,
            semesterSubId: semSubId,
            _csrf: loginData.csrf,
            x: Date.now().toString(),
        }).toString(),
        { headers: { ...headers, "Content-Type": "application/x-www-form-urlencoded" } }
    );
    
    const $ = cheerio.load(resp.data);
    const courses: string[] = [];
    $("#getStudentDetails table tbody tr").each((i, row) => {
        const cols = $(row).find("td");
        if (cols.length > 5) {
            courses.push(cols.eq(2).text().trim()); // course title
        }
    });
    
    console.log("Past semester attendance courses:", courses);
}
run();
