
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Please login to like a post." },
        { status: 401 },
      );
    }

    const body = await request.json();

    const postId =
      typeof body.postId === "string" ? body.postId.trim() : "";

    if (!postId) {
      return NextResponse.json(
        { error: "postId is required." },
        { status: 400 },
      );
    }

    // Check whether the post exists
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: {
        id: true,
        authorId: true,
      },
    });

    if (!post) {
      return NextResponse.json(
        { error: "Post not found." },
        { status: 404 },
      );
    }

    const userId = session.user.id;

    // Check existing like
    const existingLike = await prisma.like.findUnique({
      where: {
        userId_postId: { userId, postId },
      },
    });

    // Unlike
    if (existingLike) {
      await prisma.like.delete({
        where: { id: existingLike.id },
      });

      return NextResponse.json({ liked: false });
    }

    // Create like
    await prisma.like.create({
      data: { userId, postId },
    });

    // Create notification for the post owner
    if (post.authorId !== userId) {
      try {
        const actor = await prisma.user.findUnique({
          where: { id: userId },
          select: { name: true },
        });

        await prisma.notification.create({
          data: {
            type: "LIKE",
            message: "liked your post.",
            recipientId: post.authorId,
            actorId: userId,
            postId: postId,
          },
        });
      } catch (notificationError) {
        console.error(
          "Like notification error:",
          notificationError,
        );
      }
    }

    return NextResponse.json({ liked: true });
  } catch (error) {
    console.error("Like API error:", error);

    return NextResponse.json(
      { error: "Unable to update like." },
      { status: 500 },
    );
  }
}
