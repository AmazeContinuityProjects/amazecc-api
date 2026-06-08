import { NextResponse } from "next/server";
import User from "@/lib/models/Users";
import { maskUserID } from '@/lib/mask';

export async function POST(req: Request) {
    try {
        const body = await req.json().catch(()=>({}));
        const { UserID, source, enabled, data } = body;

        const maskedID = maskUserID(UserID?.toUpperCase() || '');

        if (!['vitol', 'moodle'].includes(source)) {
            return NextResponse.json({ error: 'Invalid source' }, { status: 400 });
        }

        const update: any = {
            'notifications.enabled': true,
            [`notifications.sources.${source}.enabled`]: enabled,
        };

        if (enabled && Array.isArray(data)) {
            update[`notifications.sources.${source}.data`] = data;
        }

        if (!enabled) {
            update[`notifications.sources.${source}.data`] = [];
        }

        await User.updateOne(
            { UserID: maskedID },
            { $set: update },
            { upsert: true }
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}