import { NextResponse } from "next/server";
import User from "@/lib/models/Users";
import webpush from 'web-push';
import { maskUserID } from '@/lib/mask';

type NotificationSource = 'vitol' | 'moodle';

export async function POST(req: Request) {
    try {
        const body = await req.json().catch(()=>({}));
        const { UserID } = body;
        const source = body.source as NotificationSource;
        const maskedID = maskUserID(UserID?.toUpperCase() || '');

        const user = await User.findOne({ UserID: maskedID });
        if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

        const payload = JSON.stringify({
            title: `${source.toUpperCase()} Testing`,
            body: "Testing notification for " + source,
        });

        await Promise.all(
            user.pushSubscriptions.map((sub: any) =>
                webpush.sendNotification(sub, payload)
            )
        );

        return NextResponse.json({ success: true });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}