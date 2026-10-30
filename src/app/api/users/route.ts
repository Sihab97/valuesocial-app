import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const name =
      typeof body.name === "string" ? body.name.trim() : "";
    const username =
      typeof body.username === "string"
        ? body.username.trim().toLowerCase()
        : "";
    const email =
      typeof body.email === "string"
        ? body.email.trim().toLowerCase()
        : "";

    if (!name || !username || !email) {
      return NextResponse.json(
        { error: "Name, username and email are required." },
        { status: 400 },
      );
    }

    if (
      !/^[a-z0-9_]{3,30}$/.test(username) ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      return NextResponse.json(
        { error: "Please provide a valid username and email." },
        { status: 400 },
      );
    }

    const user = await prisma.user.create({
      data: { name, username, email },
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Username or email already exists." },
        { status: 409 },
      );
    }

    console.error("Create user failed:", error);

    return NextResponse.json(
      { error: "Unable to create user." },
      { status: 500 },
    );
  }
}