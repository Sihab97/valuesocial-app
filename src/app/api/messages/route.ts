import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function getCurrentUserId() {
  const session = await auth();
  return session?.user?.id || null;
}

// GET: Load conversations or messages
export async function GET(request: Request) {
  try {
    const currentUserId = await getCurrentUserId();

    if (!currentUserId) {
      return NextResponse.json(
        { error: "Please login first." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get("conversationId");

    // Load messages in a conversation
    if (conversationId) {
      const conversation = await prisma.conversation.findFirst({
        where: {
          id: conversationId,
          OR: [
            { memberOneId: currentUserId },
            { memberTwoId: currentUserId },
          ],
        },
      });

      if (!conversation) {
        return NextResponse.json(
          { error: "Conversation not found." },
          { status: 404 }
        );
      }

      const messages = await prisma.message.findMany({
        where: { conversationId },
        include: {
          sender: {
            select: {
              id: true,
              name: true,
              username: true,
              image: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      });

      return NextResponse.json({ messages });
    }

    // Load conversation list with unread message counts
    const conversations = await prisma.conversation.findMany({
      where: {
        OR: [
          { memberOneId: currentUserId },
          { memberTwoId: currentUserId },
        ],
      },
      include: {
        memberOne: {
          select: {
            id: true,
            name: true,
            username: true,
            image: true,
          },
        },
        memberTwo: {
          select: {
            id: true,
            name: true,
            username: true,
            image: true,
          },
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        _count: {
          select: {
            messages: {
              where: {
                senderId: { not: currentUserId },
                readAt: null,
              },
            },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    const result = conversations.map((conversation) => ({
      ...conversation,
      otherUser:
        conversation.memberOneId === currentUserId
          ? conversation.memberTwo
          : conversation.memberOne,
      lastMessage: conversation.messages[0] || null,
      unreadCount: conversation._count.messages,
    }));

    const totalUnreadCount = result.reduce(
      (total, conversation) => total + conversation.unreadCount,
      0
    );

    return NextResponse.json({
      conversations: result,
      unreadCount: totalUnreadCount,
    });
  } catch (error) {
    console.error("Load messages error:", error);

    return NextResponse.json(
      { error: "Unable to load messages." },
      { status: 500 }
    );
  }
}

// POST: Send a message
export async function POST(request: Request) {
  try {
    const currentUserId = await getCurrentUserId();

    if (!currentUserId) {
      return NextResponse.json(
        { error: "Please login first." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const recipientId =
      typeof body.recipientId === "string" ? body.recipientId.trim() : "";
    const content =
      typeof body.content === "string" ? body.content.trim() : "";

    if (!recipientId || !content) {
      return NextResponse.json(
        { error: "Recipient and message are required." },
        { status: 400 }
      );
    }

    if (recipientId === currentUserId) {
      return NextResponse.json(
        { error: "You cannot message yourself." },
        { status: 400 }
      );
    }

    if (content.length > 2000) {
      return NextResponse.json(
        { error: "Message cannot exceed 2000 characters." },
        { status: 400 }
      );
    }

    const recipient = await prisma.user.findUnique({
      where: { id: recipientId },
      select: { id: true },
    });

    if (!recipient) {
      return NextResponse.json(
        { error: "Recipient not found." },
        { status: 404 }
      );
    }

    // Normalize IDs to avoid duplicate conversations
    const [memberOneId, memberTwoId] = [
      currentUserId,
      recipientId,
    ].sort();

    const conversation = await prisma.conversation.upsert({
      where: {
        memberOneId_memberTwoId: {
          memberOneId,
          memberTwoId,
        },
      },
      create: {
        memberOneId,
        memberTwoId,
      },
      update: {},
    });

    const message = await prisma.message.create({
      data: {
        content,
        conversationId: conversation.id,
        senderId: currentUserId,
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            username: true,
            image: true,
          },
        },
      },
    });

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { updatedAt: new Date() },
    });

    return NextResponse.json(
      { message, conversationId: conversation.id },
      { status: 201 }
    );
  } catch (error) {
    console.error("Send message error:", error);

    return NextResponse.json(
      { error: "Unable to send message." },
      { status: 500 }
    );
  }
}

// PATCH: Mark received messages as read
export async function PATCH(request: Request) {
  try {
    const currentUserId = await getCurrentUserId();

    if (!currentUserId) {
      return NextResponse.json(
        { error: "Please login first." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const conversationId =
      typeof body.conversationId === "string"
        ? body.conversationId.trim()
        : "";

    if (!conversationId) {
      return NextResponse.json(
        { error: "Conversation ID is required." },
        { status: 400 }
      );
    }

    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        OR: [
          { memberOneId: currentUserId },
          { memberTwoId: currentUserId },
        ],
      },
      select: { id: true },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found." },
        { status: 404 }
      );
    }

    const result = await prisma.message.updateMany({
      where: {
        conversationId,
        senderId: { not: currentUserId },
        readAt: null,
      },
      data: { readAt: new Date() },
    });

    return NextResponse.json({
      success: true,
      updatedCount: result.count,
    });
  } catch (error) {
    console.error("Mark messages read error:", error);

    return NextResponse.json(
      { error: "Unable to update message status." },
      { status: 500 }
    );
  }
}
