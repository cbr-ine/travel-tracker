import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";

const updateLocationSchema = z.object({
  name: z.string().min(1, "Location name is required").optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  order: z.number().int().min(0).optional(),
});

type RouteParams = { params: Promise<{ id: string }> };

// PUT /api/locations/:id — Update a single location
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = updateLocationSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    // Check location exists
    const existing = await db.location.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Location not found" },
        { status: 404 },
      );
    }

    const location = await db.location.update({
      where: { id },
      data: parsed.data,
    });

    return NextResponse.json(location);
  } catch (error) {
    console.error("Error updating location:", error);
    return NextResponse.json(
      { error: "Failed to update location" },
      { status: 500 },
    );
  }
}

// DELETE /api/locations/:id — Delete a single location
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // Check location exists
    const existing = await db.location.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Location not found" },
        { status: 404 },
      );
    }

    await db.location.delete({
      where: { id },
    });

    return NextResponse.json({ message: "Location deleted successfully" });
  } catch (error) {
    console.error("Error deleting location:", error);
    return NextResponse.json(
      { error: "Failed to delete location" },
      { status: 500 },
    );
  }
}
