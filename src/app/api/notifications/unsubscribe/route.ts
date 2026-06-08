import { NextResponse } from "next/server";

import User from "@/lib/models/Users";
import { maskUserID } from "@/lib/mask";



export async function POST(req: Request) {
    const {  UserID, endpoint  } = await req.json().catch(()=>({}));
    const maskedID = maskUserID(UserID?.toUpperCase() || "");

    await User.updateOne(
        { UserID: maskedID },
        {
            $pull: {
                pushSubscriptions: { endpoint }
            }
        }
    );

    return NextResponse.json({ success: true });
}

