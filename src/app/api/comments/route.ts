
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

// GET: Fetch comments of a post
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const postId = searchParams.get("postId");

    if (!postId) {
      return NextResponse.json(
        { error: "postId is required." },
        { status: 400 },
      );
    }

    const comments = await prisma.comment.findMany({
      where: { postId },
      orderBy: { createdAt: "asc" },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            image: true,
          },
        },
      },
    });

    return NextResponse.json({ comments });
  } catch (error) {
    console.error("Failed to fetch comments:", error);

    return NextResponse.json(
      { error: "Unable to fetch comments." },
      { status: 500 },
    );
  }
}

// POST: Create comment and notification
export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Please login to comment." },
        { status: 401 },
      );
    }

    const body = await request.json();

    const postId =
      typeof body.postId === "string" ? body.postId.trim() : "";

    const content =
      typeof body.content === "string" ? body.content.trim() : "";

    if (!postId || !content) {
      return NextResponse.json(
        { error: "postId and content are required." },
        { status: 400 },
      );
    }

    if (content.length > 1000) {
      return NextResponse.json(
        { error: "Comment cannot exceed 1000 characters." },
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

    // Create comment
    const comment = await prisma.comment.create({
      data: {
        content,
        userId,
        postId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            image: true,
          },
        },
      },
    });

    // Create notification for post owner
    if (post.authorId !== userId) {
      try {
        await prisma.notification.create({
          data: {
            type: "COMMENT",
            message: "commented on your post.",
            recipientId: post.authorId,
            actorId: userId,
            postId,
          },
        });
      } catch (notificationError) {
        console.error(
          "Comment notification error:",
          notificationError,
        );
      }
    }

    return NextResponse.json({ comment }, { status: 201 });
  } catch (error) {
    console.error("Failed to create comment:", error);

    return NextResponse.json(
      { error: "Unable to create comment." },
      { status: 500 },
    );
  }
}
