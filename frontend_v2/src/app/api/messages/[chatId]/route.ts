import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { z, ZodError } from "zod";

const messageSchema = z.object({
  id: z.string().optional(),
  role: z.string(),
  content: z.string(),
  status: z.string().default("complete"),
  toolRecords: z.any().optional().default([]),
  plan: z.any().nullable().optional().default(null),
  verifierScore: z.number().nullable().optional().default(null),
  executionTime: z.number().nullable().optional().default(null),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { chatId } = await params;
  if (!chatId) {
    return NextResponse.json({ error: "Chat ID is required" }, { status: 400 });
  }

  try {
    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
    });

    if (!chat) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 });
    }

    if (chat.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const messages = await prisma.message.findMany({
      where: { chatId },
      orderBy: { timestamp: "asc" },
    });

    return NextResponse.json(messages);
  } catch (error) {
    console.error("Error fetching messages:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { chatId } = await params;
  if (!chatId) {
    return NextResponse.json({ error: "Chat ID is required" }, { status: 400 });
  }

  try {
    const body = await req.json();
    const validatedData = messageSchema.parse(body);

    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
    });

    if (!chat) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 });
    }

    if (chat.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const message = await prisma.message.upsert({
      where: { id: validatedData.id || "temp-id-that-wont-match" },
      update: {
        role: validatedData.role,
        content: validatedData.content,
        status: validatedData.status,
        toolRecords: validatedData.toolRecords || [],
        plan: validatedData.plan || null,
        verifierScore: validatedData.verifierScore || null,
        executionTime: validatedData.executionTime || null,
      },
      create: {
        id: validatedData.id,
        chatId: chatId,
        role: validatedData.role,
        content: validatedData.content,
        status: validatedData.status,
        toolRecords: validatedData.toolRecords || [],
        plan: validatedData.plan || null,
        verifierScore: validatedData.verifierScore || null,
        executionTime: validatedData.executionTime || null,
      },
    });

    // Update the chat's updatedAt timestamp
    await prisma.chat.update({
      where: { id: chatId },
      data: { updatedAt: new Date() },
    });

    return NextResponse.json(message);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Invalid data", details: error.issues }, { status: 400 });
    }
    console.error("Error creating message:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
