import { NextResponse } from "next/server";

import User from "@/lib/models/Users";
import { maskUserID } from '@/lib/mask';



export async function POST(req: Request) {
    const {  UserID, subscription  } = await req.json().catch(()=>({}));
    const maskedID = maskUserID(UserID?.toUpperCase() || "");

    if (!subscription?.endpoint) {
        return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 });
    }

    await User.updateOne(
        { UserID: maskedID },
        {
            $addToSet: {
                pushSubscriptions: subscription
            }
        }
    );

    return NextResponse.json({ success: true });
}

