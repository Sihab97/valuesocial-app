
import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";


cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function POST(request: Request) {
  try {
    // Check login session
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json(
        { error: "Please login first." },
        { status: 401 },
      );
    }

    // Get uploaded image
    const formData = await request.formData();
    const file = formData.get("image");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Please select an image." },
        { status: 400 },
      );
    }

    // Validate image type
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Only JPG, PNG and WEBP images are allowed." },
        { status: 400 },
      );
    }

    // Maximum size: 5 MB
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Image size cannot exceed 5 MB." },
        { status: 400 },
      );
    }

    // Convert image to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Upload image to Cloudinary
    const uploadResult = await new Promise<{ secure_url: string }>(
      (resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: "valuesocial/profile-images",
            public_id: userId,
            overwrite: true,
            resource_type: "image",
          },
          (error, result) => {
            if (error) {
              reject(error);
            } else if (result) {
              resolve(result);
            } else {
              reject(new Error("Image upload failed."));
            }
          },
        );

        stream.end(buffer);
      },
    );

    // Save image URL in database
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        image: uploadResult.secure_url,
      },
      select: {
        id: true,
        name: true,
        username: true,
        image: true,
      },
    });

    return NextResponse.json({
      message: "Profile picture uploaded successfully!",
      user,
    });
  } catch (error) {
    console.error("Profile image upload error:", error);

    return NextResponse.json(
      { error: "Unable to upload profile picture." },
      { status: 500 },
    );
  }
}
