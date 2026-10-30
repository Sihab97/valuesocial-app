
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

// GET: Current user or another user's public profile
export async function GET(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Please login first." },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(request.url);
    const requestedUserId = searchParams.get("userId");

    // If userId is provided, fetch that user's public profile.
    if (requestedUserId) {
      const user = await prisma.user.findUnique({
        where: { id: requestedUserId },
        select: {
          id: true,
          name: true,
          username: true,
          bio: true,
          image: true,
          createdAt: true,
          _count: {
            select: {
              posts: true,
              followers: true,
              following: true,
            },
          },
        },
      });

      if (!user) {
        return NextResponse.json(
          { error: "User not found." },
          { status: 404 },
        );
      }

      return NextResponse.json({ user });
    }

    // Otherwise, fetch the logged-in user's own profile.
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        bio: true,
        image: true,
        createdAt: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found." },
        { status: 404 },
      );
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error("Profile fetch error:", error);

    return NextResponse.json(
      { error: "Unable to fetch profile." },
      { status: 500 },
    );
  }
}

// PUT: Update current user's profile
export async function PUT(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Please login first." },
        { status: 401 },
      );
    }

    const body = await request.json();

    const name =
      typeof body.name === "string" ? body.name.trim() : "";

    const bio =
      typeof body.bio === "string" ? body.bio.trim() : "";

    if (!name) {
      return NextResponse.json(
        { error: "Name is required." },
        { status: 400 },
      );
    }

    if (name.length > 80) {
      return NextResponse.json(
        { error: "Name cannot exceed 80 characters." },
        { status: 400 },
      );
    }

    if (bio.length > 300) {
      return NextResponse.json(
        { error: "Bio cannot exceed 300 characters." },
        { status: 400 },
      );
    }

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        name,
        bio: bio || null,
      },
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        bio: true,
        image: true,
      },
    });

    return NextResponse.json({
      message: "Profile updated successfully!",
      user,
    });
  } catch (error) {
    console.error("Profile update error:", error);

    return NextResponse.json(
      { error: "Unable to update profile." },
      { status: 500 },
    );
  }
}
