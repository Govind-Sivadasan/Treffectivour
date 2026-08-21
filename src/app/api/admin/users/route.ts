import { NextResponse } from "next/server";
import type { Role } from "@prisma/client";
import { hashPassword, requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const { email, name, password, role } = await request.json();

    if (!email || !name || !password) {
      return NextResponse.json(
        { error: "email, name, password required" },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "Email already exists" }, { status: 409 });
    }

    const user = await prisma.user.create({
      data: {
        email,
        name,
        passwordHash: await hashPassword(password),
        role: role === "ADMIN" ? "ADMIN" : "USER",
      },
      select: { id: true, email: true, name: true, role: true },
    });

    return NextResponse.json({ user });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    if (msg === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (msg === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    await requireAdmin();
    const { userId, name, email, password, role } = await request.json();

    if (!userId || !name || !email) {
      return NextResponse.json(
        { error: "userId, name, and email required" },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findUnique({ where: { id: userId } });
    if (!existing) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const emailTaken = await prisma.user.findFirst({
      where: { email, NOT: { id: userId } },
    });
    if (emailTaken) {
      return NextResponse.json({ error: "Email already exists" }, { status: 409 });
    }

    const data: { name: string; email: string; role?: Role; passwordHash?: string } = {
      name,
      email,
    };

    if (role === "ADMIN" || role === "USER") {
      data.role = role;
    }

    if (password) {
      if (password.length < 6) {
        return NextResponse.json(
          { error: "Password must be at least 6 characters" },
          { status: 400 }
        );
      }
      data.passwordHash = await hashPassword(password);
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data,
      select: { id: true, email: true, name: true, role: true },
    });

    return NextResponse.json({ user });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    if (msg === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (msg === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await requireAdmin();
    const userId = new URL(request.url).searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }

    if (userId === session.id) {
      return NextResponse.json({ error: "You cannot delete your own account" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (user.role === "ADMIN") {
      const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
      if (adminCount <= 1) {
        return NextResponse.json({ error: "Cannot delete the last admin" }, { status: 400 });
      }
    }

    await prisma.user.delete({ where: { id: userId } });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    if (msg === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (msg === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
  }
}
