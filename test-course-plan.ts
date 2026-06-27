import { parseVtopHtml } from "./src/lib/parsers/auto-parse";
import VTOPClient from "./src/lib/clients/VTOPClient";
import fs from "fs";
import { URLSearchParams } from "url";

async function run() {
  console.log("Starting test...");
  
  // 1. We need to login. We can hit the local login endpoint if it's running, or we can just send the request if we have cookies.
  // Actually, we can just use fetch to localhost:3000/api/login of AmazeCC-API, but since it's not running, let's start it.
}

run();
