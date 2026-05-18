import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const chats = await prisma.chat.findMany({
      where: { userId: session.user.id },
      orderBy: { updatedAt: "desc" },
    });
    return NextResponse.json(chats);
  } catch (error) {
    console.error("Error fetching chats:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { title } = await req.json();
    const chat = await prisma.chat.create({
      data: {
        userId: session.user.id,
        title: title || "New Conversation",
      },
    });
    return NextResponse.json(chat);
  } catch (error) {
    console.error("Error creating chat:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
