
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

// POST: Follow or Unfollow a user
export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Please login first." },
        { status: 401 },
      );
    }

    const body = await request.json();
    const targetUserId =
      typeof body.userId === "string" ? body.userId.trim() : "";

    const currentUserId = session.user.id;

    if (!targetUserId) {
      return NextResponse.json(
        { error: "User ID is required." },
        { status: 400 },
      );
    }

    if (targetUserId === currentUserId) {
      return NextResponse.json(
        { error: "You cannot follow yourself." },
        { status: 400 },
      );
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true },
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: "User not found." },
        { status: 404 },
      );
    }

    const existingFollow = await prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId: currentUserId,
          followingId: targetUserId,
        },
      },
    });

    let following: boolean;

    if (existingFollow) {
      // Unfollow
      await prisma.follow.delete({
        where: { id: existingFollow.id },
      });

      following = false;
    } else {
      // Follow
      await prisma.follow.create({
        data: {
          followerId: currentUserId,
          followingId: targetUserId,
        },
      });

      following = true;

      // Create notification for the followed user
      try {
        await prisma.notification.create({
          data: {
            type: "FOLLOW",
            message: "started following you.",
            recipientId: targetUserId,
            actorId: currentUserId,
          },
        });
      } catch (notificationError) {
        console.error(
          "Follow notification error:",
          notificationError,
        );
      }
    }

    const [followersCount, followingCount] = await Promise.all([
      prisma.follow.count({
        where: { followingId: targetUserId },
      }),
      prisma.follow.count({
        where: { followerId: targetUserId },
      }),
    ]);

    return NextResponse.json({
      message: following
        ? "User followed successfully!"
        : "User unfollowed successfully!",
      following,
      followersCount,
      followingCount,
    });
  } catch (error) {
    console.error("Follow API error:", error);

    return NextResponse.json(
      { error: "Unable to update follow status." },
      { status: 500 },
    );
  }
}

// GET: Follow status, counts, and user lists
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

    const targetUserId = searchParams.get("userId");
    const listType = searchParams.get("type");

    if (!targetUserId) {
      return NextResponse.json(
        { error: "User ID is required." },
        { status: 400 },
      );
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true },
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: "User not found." },
        { status: 404 },
      );
    }

    // Get Followers List
    if (listType === "followers") {
      const followers = await prisma.follow.findMany({
        where: { followingId: targetUserId },
        orderBy: { createdAt: "desc" },
        include: {
          follower: {
            select: {
              id: true,
              name: true,
              username: true,
              image: true,
            },
          },
        },
      });

      return NextResponse.json({
        users: followers.map((item) => item.follower),
      });
    }

    // Get Following List
    if (listType === "following") {
      const following = await prisma.follow.findMany({
        where: { followerId: targetUserId },
        orderBy: { createdAt: "desc" },
        include: {
          following: {
            select: {
              id: true,
              name: true,
              username: true,
              image: true,
            },
          },
        },
      });

      return NextResponse.json({
        users: following.map((item) => item.following),
      });
    }

    // Get Follow Status and Counts
    const currentUserId = session.user.id;

    const [isFollowing, followersCount, followingCount] =
      await Promise.all([
        prisma.follow.findUnique({
          where: {
            followerId_followingId: {
              followerId: currentUserId,
              followingId: targetUserId,
            },
          },
        }),
        prisma.follow.count({
          where: { followingId: targetUserId },
        }),
        prisma.follow.count({
          where: { followerId: targetUserId },
        }),
      ]);

    return NextResponse.json({
      following: Boolean(isFollowing),
      followersCount,
      followingCount,
    });
  } catch (error) {
    console.error("Follow API error:", error);

    return NextResponse.json(
      { error: "Unable to fetch follow information." },
      { status: 500 },
    );
  }
}
