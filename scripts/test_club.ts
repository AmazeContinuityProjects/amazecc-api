
import dotenv from "dotenv";
dotenv.config({ path: "C:/Users/sugee/Documents/testing/.env" });

async function run() {
  const username = process.env.VTOP_USERNAME;
  const password = process.env.VTOP_PASSWORD;
  
  let apiCookies: string[] = [];
  let authorizedID = "";
  let csrfToken = "";
  
  const apiRes = await fetch("http://localhost:3000/api/login", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password })
  });
  const data = await apiRes.json();
  if(!data.success) return;
  apiCookies = Array.isArray(data.cookies) ? data.cookies : [data.cookies];
  authorizedID = data.authorizedID;
  csrfToken = data.csrf;

  const clubRes = await fetch("http://localhost:3000/api/club-enrollment", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cookies: apiCookies, authorizedID, csrf: csrfToken })
  });
  const clubData = await clubRes.json();
  if(clubData.tables && clubData.tables.length > 0) {
    console.log(JSON.stringify(clubData.tables[0].rows.slice(0, 5), null, 2));
  }
}

run().catch(console.error);
