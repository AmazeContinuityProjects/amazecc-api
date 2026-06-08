import { NextResponse } from "next/server";

import User from "@/lib/models/Users";
import { maskUserID } from "@/lib/mask";



export async function GET(req: Request) {
    const UserID = new URL(req.url).searchParams.get("UserID");

    if (!UserID) {
        return NextResponse.json({ error: "UserID required" }, { status: 400 });
    }

    const maskedID = maskUserID(String(UserID).toUpperCase());
    const user = await User.findOne({ UserID: maskedID });

    if (!user || !user.notifications) {
        return NextResponse.json({
            vitol: false,
            moodle: false,
        });
    }

    return NextResponse.json({
        vitol: !!user.notifications.sources?.vitol?.enabled,
        moodle: !!user.notifications.sources?.moodle?.enabled,
    });
}


