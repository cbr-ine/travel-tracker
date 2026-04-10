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

const createTrajectorySchema = z.object({
  name: z.string().min(1, "Trajectory name is required"),
  startDate: z.string().datetime(),
  endDate: z.string().datetime().optional(),
  color: z.string().default("#E85D4A"),
  note: z.string().optional(),
  locations: z.array(locationSchema).min(1, "At least one location is required"),
});

// GET /api/trajectories — List all trajectories with locations
export async function GET() {
  try {
    const trajectories = await db.trajectory.findMany({
      include: {
        locations: {
          orderBy: { order: "asc" },
        },
      },
      orderBy: { startDate: "desc" },
    });

    return NextResponse.json(trajectories);
  } catch (error) {
    console.error("Error fetching trajectories:", error);
    return NextResponse.json(
      { error: "Failed to fetch trajectories" },
      { status: 500 },
    );
  }
}

// POST /api/trajectories — Create a new trajectory with locations
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = createTrajectorySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const { name, startDate, endDate, color, note, locations } = parsed.data;

    const trajectory = await db.trajectory.create({
      data: {
        name,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        color,
        note,
        locations: {
          create: locations.map((loc) => ({
            name: loc.name,
            latitude: loc.latitude,
            longitude: loc.longitude,
            order: loc.order,
          })),
        },
      },
      include: {
        locations: {
          orderBy: { order: "asc" },
        },
      },
    });

    return NextResponse.json(trajectory, { status: 201 });
  } catch (error) {
    console.error("Error creating trajectory:", error);
    return NextResponse.json(
      { error: "Failed to create trajectory" },
      { status: 500 },
    );
  }
}
