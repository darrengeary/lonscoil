import { auth } from "@/auth";
import cloudinary from "@/lib/cloudinary";
import { NextRequest, NextResponse } from "next/server";

function isAdmin(user: any) {
  return user && user.role === "ADMIN";
}

export const runtime = "nodejs";

export const POST = auth(async (req: NextRequest & { auth?: any }) => {
  try {
    if (!req.auth || !isAdmin(req.auth.user)) {
      return new Response("Unauthorized", { status: 401 });
    }

    // sanity log (safe; doesn't reveal secrets)
    console.log("Cloudinary cloud:", process.env.CLOUDINARY_CLOUD_NAME);

    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);
    if (!allowed.has(file.type)) {
      return NextResponse.json({ error: "Only JPG/PNG/WebP allowed" }, { status: 400 });
    }

    const maxBytes = 5 * 1024 * 1024;
    if (file.size > maxBytes) {
      return NextResponse.json({ error: "File too large (max 5MB)" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const uploaded = await new Promise<any>((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          { folder: "meal-choices", resource_type: "image" },
          (error, result) => (error ? reject(error) : resolve(result))
        )
        .end(buffer);
    });

    return NextResponse.json({ url: uploaded.secure_url });
  } catch (err: any) {
    console.error("UPLOAD ERROR:", err);
    return NextResponse.json(
      { error: err?.message ?? "Upload failed", details: String(err) },
      { status: 500 }
    );
  }
});
