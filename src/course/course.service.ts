import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NodeLevel } from '@prisma/client';

@Injectable()
export class CourseService {
  constructor(private prisma: PrismaService) {}

  async findAllCourses(userId?: number): Promise<any> {
    const whereCondition: any = {
      parentNodeId: null,
      nodeLevel: NodeLevel.LEVEL1,
    };

    const selectFields: any = {
      id: true,
      nodeName: true,
      nodeLevel: true,
      description: true,
      estimatedDuration: true,
      learningRecords: {
        where: { userId },
        select: {
          isCompleted: true,
          duration: true,
        },
      },
    };

    const nodes = await this.prisma.node.findMany({
      where: whereCondition,
      select: selectFields,
    });

    return nodes.map((node) => {
      const record = node.learningRecords?.[0] as
        | { isCompleted: boolean; duration: number }
        | undefined;

      return {
        id: node.id,
        title: node.nodeName,
        description: node.description ?? '',
        estimatedDuration: node.estimatedDuration ?? 0,
        duration: record?.duration ?? 0,
        isCompleted: record?.isCompleted ?? false,
      };
    });
  }

  async getCourse(courseId: number) {
    return this.prisma.node.findMany({
      where: {
        id: courseId,
        parentNodeId: null,
        nodeLevel: NodeLevel.LEVEL1,
      },
      orderBy: { order: 'asc' },
      select: {
        id: true,
        nodeName: true,
        nodeLevel: true,
        description: true,
        order: true,
        parentNodeId: true,

        childNodes: {
          where: { nodeLevel: NodeLevel.LEVEL2 },
          orderBy: { order: 'asc' },
          select: {
            id: true,
            nodeName: true,
            nodeLevel: true,
            description: true,
            order: true,
            parentNodeId: true,

            childNodes: {
              where: { nodeLevel: NodeLevel.LEVEL3 },
              orderBy: { order: 'asc' },
              select: {
                id: true,
                nodeName: true,
                nodeLevel: true,
                description: true,
                order: true,
                parentNodeId: true,

                childNodes: {
                  where: { nodeLevel: NodeLevel.LEVEL4 },
                  orderBy: { order: 'asc' },
                  select: {
                    id: true,
                    nodeName: true,
                    nodeLevel: true,
                    description: true,
                    order: true,
                    parentNodeId: true,
                  },
                },
              },
            },
          },
        },
      },
    });
  }
}
