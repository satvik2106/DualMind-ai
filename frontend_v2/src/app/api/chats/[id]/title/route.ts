import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: chatId } = await params;

  try {
    const { title } = await req.json();

    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
    });

    if (!chat || chat.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.chat.update({
      where: { id: chatId },
      data: { title },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error renaming chat:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
