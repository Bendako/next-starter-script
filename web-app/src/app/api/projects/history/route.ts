import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const projects = await prisma.project.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 10, // Latest 10 projects
      select: {
        id: true,
        name: true,
        template: true,
        status: true,
        createdAt: true,
      },
    });

    const formattedProjects = projects.map((project: any) => ({
      id: project.id,
      name: project.name,
      template: project.template,
      status: project.status,
      createdAt: project.createdAt.toLocaleDateString(),
    }));

    return NextResponse.json({ projects: formattedProjects });
  } catch (error) {
    console.error('Error fetching project history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch project history' },
      { status: 500 }
    );
  }
} 