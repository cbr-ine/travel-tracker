import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";

const locationSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Location name is required"),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  order: z.number().int().min(0),
});

const updateTrajectorySchema = z.object({
  name: z.string().min(1, "Trajectory name is required").optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().nullable().optional(),
  color: z.string().optional(),
  note: z.string().nullable().optional(),
  locations: z.array(locationSchema).min(1, "At least one location is required").optional(),
});

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/trajectories/:id — Get a single trajectory with locations
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const trajectory = await db.trajectory.findUnique({
      where: { id },
      include: {
        locations: {
          orderBy: { order: "asc" },
        },
      },
    });

    if (!trajectory) {
      return NextResponse.json(
        { error: "Trajectory not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(trajectory);
  } catch (error) {
    console.error("Error fetching trajectory:", error);
    return NextResponse.json(
      { error: "Failed to fetch trajectory" },
      { status: 500 },
    );
  }
}

// PUT /api/trajectories/:id — Update trajectory and optionally replace locations
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = updateTrajectorySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    // Check trajectory exists
    const existing = await db.trajectory.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Trajectory not found" },
        { status: 404 },
      );
    }

    const { name, startDate, endDate, color, note, locations } = parsed.data;

    // Build update data
    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (startDate !== undefined) updateData.startDate = new Date(startDate);
    if (endDate !== undefined) updateData.endDate = endDate ? new Date(endDate) : null;
    if (color !== undefined) updateData.color = color;
    if (note !== undefined) updateData.note = note;

    // If locations are provided, replace all locations for this trajectory
    if (locations) {
      updateData.locations = {
        deleteMany: { trajectoryId: id },
        create: locations.map((loc) => ({
          name: loc.name,
          latitude: loc.latitude,
          longitude: loc.longitude,
          order: loc.order,
        })),
      };
    }

    const trajectory = await db.trajectory.update({
      where: { id },
      data: updateData,
      include: {
        locations: {
          orderBy: { order: "asc" },
        },
      },
    });

    return NextResponse.json(trajectory);
  } catch (error) {
    console.error("Error updating trajectory:", error);
    return NextResponse.json(
      { error: "Failed to update trajectory" },
      { status: 500 },
    );
  }
}

// DELETE /api/trajectories/:id — Delete trajectory (cascade deletes locations)
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // Check trajectory exists
    const existing = await db.trajectory.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Trajectory not found" },
        { status: 404 },
      );
    }

    await db.trajectory.delete({
      where: { id },
    });

    return NextResponse.json({ message: "Trajectory deleted successfully" });
  } catch (error) {
    console.error("Error deleting trajectory:", error);
    return NextResponse.json(
      { error: "Failed to delete trajectory" },
      { status: 500 },
    );
  }
}
