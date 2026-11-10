import axios from "axios";
import { vitHttpsAgent } from "@/lib/vitTls";

const agent = vitHttpsAgent();

const LMSClient = axios.create({
    baseURL: "https://lms.vit.ac.in",
    httpsAgent: agent,
    withCredentials: true,
});

export default LMSClient;