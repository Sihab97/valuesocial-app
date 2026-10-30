import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
export const instant = false;

export async function GET(request: Request) {
  try {
    // Wait for an incoming request before accessing session headers.
    // This prevents Cache Components from trying to prerender auth().

    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Please login first" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q")?.trim();

    if (!query || query.length < 2) {
      return NextResponse.json([]);
    }

    const users = await prisma.user.findMany({
      where: {
        AND: [
          { id: { not: session.user.id } },
          {
            OR: [
              {
                name: {
                  contains: query,
                  mode: "insensitive",
                },
              },
              {
                username: {
                  contains: query,
                  mode: "insensitive",
                },
              },
            ],
          },
        ],
      },
      select: {
        id: true,
        name: true,
        username: true,
        image: true,
        bio: true,
      },
      take: 20,
      orderBy: {
        name: "asc",
      },
    });

    return NextResponse.json(users);
  } catch (error) {
    console.error("User search error:", error);

    return NextResponse.json(
      { error: "Failed to search users" },
      { status: 500 }
    );
  }
}
