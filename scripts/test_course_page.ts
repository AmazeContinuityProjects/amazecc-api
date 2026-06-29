import dotenv from "dotenv";
dotenv.config({ path: "C:/Users/sugee/Documents/testing/.env" });

import VTOPClient from "../src/lib/clients/VTOPClient";

async function run() {
  const client = VTOPClient();
  const username = process.env.VTOP_USERNAME;
  const password = process.env.VTOP_PASSWORD;
  
  let apiCookies: string[] = [];
  let authorizedID = "";
  let csrfToken = "";
  
  const apiRes = await fetch("http://localhost:3000/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });
  const data = await apiRes.json();
  apiCookies = Array.isArray(data.cookies) ? data.cookies : [data.cookies];
  authorizedID = data.authorizedID;
  csrfToken = data.csrf;

  const pageRes = await fetch("http://localhost:3000/api/course-page", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cookies: apiCookies, authorizedID, csrf: csrfToken })
  });
  const pageData = await pageRes.json();
  const semSubId = pageData.semesters.find((s:any) => s.value === 'CH20252605').value;
  
  const coursesRes = await fetch("http://localhost:3000/api/course-page", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cookies: apiCookies, authorizedID, csrf: csrfToken, formData: { semesterSubId: semSubId } })
  });
  const coursesData = await coursesRes.json();
  const courseCode = coursesData.results.selectOptions.courseCode[1].value;

  const slotRes = await fetch("http://localhost:3000/api/course-page", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cookies: apiCookies, authorizedID, csrf: csrfToken, formData: { semesterSubId: semSubId, courseCode } })
  });
  const slotData = await slotRes.json();
  const slotId = slotData.results.selectOptions.slotId[1].value;

  const facultyRes = await fetch("http://localhost:3000/api/course-page", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cookies: apiCookies, authorizedID, csrf: csrfToken, formData: { semesterSubId: semSubId, courseCode, slotId } })
  });
  const facultyData = await facultyRes.json();
  const faculty = facultyData.results.selectOptions.faculty[1].value;

  const detailsRes = await fetch("http://localhost:3000/api/course-page", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cookies: apiCookies, authorizedID, csrf: csrfToken, formData: { semesterSubId: semSubId, courseCode, slotId, faculty } })
  });
  const detailsData = await detailsRes.json();
  
  const table = detailsData.results.tables[0];
  const viewClassId = table.rows[0]["Class Id"];
  const rawFaculty = table.rows[0]["Faculty"];
  const erpId = rawFaculty.split("-")[0].trim();

  console.log(`Testing view detail without slotId/faculty...`);
  const viewRes = await fetch("http://localhost:3000/api/course-page", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cookies: apiCookies, authorizedID, csrf: csrfToken, formData: { 
      viewDetail: "true", semSubId, classId: viewClassId, erpId
    }})
  });
  const viewData = await viewRes.json();
  console.log("View detail success?", viewData.success, "tables:", viewData?.results?.tables?.length);
  if (!viewData?.results?.tables?.length) {
    console.log("Failed to load tables!");
  }
}

run().catch(console.error);
