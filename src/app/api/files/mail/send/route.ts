import { NextResponse } from 'next/server';
import { mailTransporter } from "@/lib/clients/nodemailer";



/**
 * @openapi
 * /api/files/mail/send:
 *   post:
 *     tags:
 *       - Files
 *     summary: POST endpoint for /api/files/mail/send
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       400:
 *         description: Bad Request
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal Server Error
 */

export async function POST(req: Request) {
    try {
        const formData = await req.formData();
        const email = formData.get("email") as string | null;
        const subject = formData.get("subject") as string | null;
        const files = formData.getAll("files") as File[];

        if (!email || !files || files.length === 0) {
            return new NextResponse("Email and files are required", { status: 400 });
        }

        const attachments = await Promise.all(
            files.map(async (file) => ({
                filename: file.name,
                content: Buffer.from(await file.arrayBuffer()),
                contentType: file.type,
            }))
        );

        await mailTransporter.sendMail({
            from: `Unicc <${process.env.SMTP_USER}>`,
            to: email,
            subject: subject || "Files from Uni-cc",
            text: `Your files, sent on ${new Date().toLocaleString()}`,
            attachments,
        });

        return new NextResponse("Email sent successfully", { status: 200 });
    } catch (error) {
        console.error("Email Send Error:", error);
        return new NextResponse("Failed to send email", { status: 500 });
    }
}