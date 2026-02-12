import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NodeLevel, Prisma } from '@prisma/client';
import { TencentCosService } from '../common/tencent-cos/tencent-cos.service';

@Injectable()
export class CourseService {
  constructor(
    private prisma: PrismaService,
    private cosService: TencentCosService,
  ) {}

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
        select: { isCompleted: true, duration: true },
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
  /**
   * 1. 获取课程大纲 (Outline)
   * 用于课程详情界面，仅展示层级结构，不包含具体的资源文件详情和签名链接
   */
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

  /**
   * 2. 获取课程知识图谱 (Knowledge Graph)
   * 用于可视化图谱界面，包含资源详情 (Resource) 和腾讯云 COS 签名 URL
   */
  async getCourseKnowledgeGraph(courseId: number) {
    const courses = await this.prisma.node.findMany({
      where: {
        id: courseId,
        parentNodeId: null,
        nodeLevel: NodeLevel.LEVEL1,
      },
      select: this.buildGraphSelect(),
    });

    if (!courses.length) return [];

    const course = courses[0];
    // 递归收集所有 LEVEL4 节点
    const level4Nodes = this.collectLevel4Nodes(course);

    if (level4Nodes.length > 0) {
      const nodeIds = level4Nodes.map((n) => n.id);
      // 批量获取 COS 签名链接
      const signedUrls = await this.cosService.getMultipleSignedUrls(nodeIds);

      // 将 URL 回填到对应的资源对象中
      level4Nodes.forEach((node, index) => {
        if (node.resource) {
          node.resource.signedUrl = signedUrls[index] ?? null;
        }
      });
    }

    return courses;
  }

  // --- 辅助私有方法 ---

  /**
   * 构建图谱所需的 Select 结构 (包含 Resource)
   */
  private buildGraphSelect(): Prisma.NodeSelect {
    const baseFields = {
      id: true,
      nodeName: true,
      nodeLevel: true,
      description: true,
      order: true,
      parentNodeId: true,
    };

    return {
      ...baseFields,
      childNodes: {
        where: { nodeLevel: NodeLevel.LEVEL2 },
        orderBy: { order: 'asc' },
        select: {
          ...baseFields,
          childNodes: {
            where: { nodeLevel: NodeLevel.LEVEL3 },
            orderBy: { order: 'asc' },
            select: {
              ...baseFields,
              childNodes: {
                where: { nodeLevel: NodeLevel.LEVEL4 },
                orderBy: { order: 'asc' },
                select: {
                  ...baseFields,
                  resource: {
                    select: {
                      id: true,
                      resourceName: true,
                      resourceType: true,
                      fileSize: true,
                      fileFormat: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    };
  }

  /**
   * 递归收集 LEVEL4 节点
   */
  private collectLevel4Nodes(node: any, result: any[] = []) {
    if (node.nodeLevel === NodeLevel.LEVEL4) {
      result.push(node);
      return result;
    }
    if (node.childNodes?.length) {
      for (const child of node.childNodes) {
        this.collectLevel4Nodes(child, result);
      }
    }
    return result;
  }
}
