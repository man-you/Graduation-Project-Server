import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NodeLevel, Role } from '@prisma/client';
import { TencentCosService } from '../common/tencent-cos/tencent-cos.service';
import { AssignCourseDto } from './dto/assign-course.dto';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';

@Injectable()
export class CourseService {
  constructor(
    private prisma: PrismaService,
    private cosService: TencentCosService,
  ) {}

  // ==========================================
  // 1. 节点创建 (Create)
  // ==========================================

  async createNode(userId: number, dto: CreateCourseDto): Promise<any> {
    const user = await this.validateUser(userId);
    const {
      nodeLevel,
      parentNodeId,
      nodeName,
      description,
      estimatedDuration,
    } = dto;

    if (nodeLevel === NodeLevel.LEVEL1) {
      if (user.role !== Role.teacher)
        throw new HttpException('只有教师可以创建课程', HttpStatus.FORBIDDEN);
      if (parentNodeId)
        throw new HttpException('根节点不能有父节点', HttpStatus.BAD_REQUEST);
    } else {
      if (!parentNodeId)
        throw new HttpException('子节点必须指定父节点', HttpStatus.BAD_REQUEST);
      const parent = await this.validateNode(parentNodeId);
      this.validateNodeHierarchy(parent.nodeLevel, nodeLevel);
    }

    const maxOrderNode = await this.prisma.node.findFirst({
      where: { parentNodeId: parentNodeId || null },
      orderBy: { order: 'desc' },
    });
    const nextOrder = (maxOrderNode?.order || 0) + 1;

    return this.prisma.node.create({
      data: {
        nodeName,
        nodeLevel,
        description,
        estimatedDuration,
        order: nextOrder,
        creatorId: nodeLevel === NodeLevel.LEVEL1 ? userId : null,
        parentNodeId: parentNodeId || null,
        // 隐式关联不需要初始化空数组，Prisma 会处理中间表
      },
      select: this.getNodeBasicSelect(),
    });
  }

  // ==========================================
  // 2. 节点更新 (Update)
  // ==========================================

  async updateNode(
    userId: number,
    nodeId: number,
    dto: UpdateCourseDto,
  ): Promise<any> {
    await this.validateUser(userId);
    const nodeToUpdate = await this.validateNode(nodeId);

    const rootNode = await this.findRootNode(nodeToUpdate);
    if (rootNode.creatorId !== userId) {
      throw new HttpException('无权限修改此节点', HttpStatus.FORBIDDEN);
    }

    const { parentNodeId, nodeLevel, ...restData } = dto;
    const updateData: any = { ...restData };

    if (nodeLevel) {
      this.validateNodeHierarchyForUpdate(nodeToUpdate, nodeLevel);
      updateData.nodeLevel = nodeLevel;
    }

    if (parentNodeId !== undefined) {
      throw new HttpException(
        '不支持直接修改父节点关系',
        HttpStatus.BAD_REQUEST,
      );
    }

    return this.prisma.node.update({
      where: { id: nodeId },
      data: updateData,
      select: this.getNodeBasicSelect(),
    });
  }

  // ==========================================
  // 3. 节点删除 (Delete)
  // ==========================================

  async deleteNode(userId: number, nodeId: number): Promise<any> {
    await this.validateUser(userId);
    const nodeToDelete = await this.validateNode(nodeId);

    const rootNode = await this.findRootNode(nodeToDelete);
    if (rootNode.creatorId !== userId) {
      throw new HttpException('无权限删除此节点', HttpStatus.FORBIDDEN);
    }

    await this.prisma.$transaction(async (tx) => {
      await this.deleteNodeAndChildren(tx, nodeId);
    });

    return { success: true, message: '节点及其子节点删除成功' };
  }

  private async deleteNodeAndChildren(tx: any, nodeId: number) {
    const children = await tx.node.findMany({
      where: { parentNodeId: nodeId },
      select: { id: true },
    });
    for (const child of children) {
      await this.deleteNodeAndChildren(tx, child.id);
    }
    await tx.node.delete({ where: { id: nodeId } });
  }

  // ==========================================
  // 4. 业务逻辑：课程分配 (核心变动：改用关系操作)
  // ==========================================

  async assignCourseToStudents(
    teacherId: number,
    dto: AssignCourseDto,
  ): Promise<any> {
    const { courseId, studentIds } = dto;

    await this.validateUser(teacherId);

    // 验证课程所有权
    const course = await this.prisma.node.findUnique({
      where: { id: courseId, nodeLevel: NodeLevel.LEVEL1 },
      select: { creatorId: true },
    });

    if (!course || course.creatorId !== teacherId) {
      throw new HttpException('课程不存在或无权限', HttpStatus.NOT_FOUND);
    }

    // 验证学生 ID
    const validStudents = await this.prisma.user.findMany({
      where: { id: { in: studentIds }, role: Role.student },
      select: { id: true },
    });

    if (validStudents.length !== studentIds.length) {
      throw new HttpException('包含无效学生ID', HttpStatus.BAD_REQUEST);
    }

    // 隐式关联：使用 connect 建立关系
    await this.prisma.node.update({
      where: { id: courseId },
      data: {
        students: {
          // 如果是覆盖式分配用 set，如果是追加式分配用 connect
          connect: studentIds.map((id) => ({ id })),
        },
      } as any,
    });

    return { success: true, message: '课程分配成功' };
  }

  // ==========================================
  // 5. 查询逻辑 (支持教师和学生双重角色)
  // ==========================================

  async findAllCourses(userId: number): Promise<any> {
    const user = await this.validateUser(userId);

    // 根据用户角色构建不同的查询条件
    let whereCondition: any;

    if (user.role === Role.teacher) {
      // 教师：查看自己创建的课程
      whereCondition = {
        parentNodeId: null,
        nodeLevel: NodeLevel.LEVEL1,
        creatorId: userId,
      };
    } else {
      // 学生：查看被分配给自己的课程
      whereCondition = {
        parentNodeId: null,
        nodeLevel: NodeLevel.LEVEL1,
        students: {
          some: { id: userId },
        },
      };
    }

    const nodes = await this.prisma.node.findMany({
      where: whereCondition,
      select: {
        id: true,
        nodeName: true,
        nodeLevel: true,
        description: true,
        estimatedDuration: true,
        creatorId: true,
        parentNodeId: true,
        createdAt: true,
        // 为了方便前端逻辑，我们需要知道这个节点关联了哪些学生 ID
        students: {
          select: { id: true },
        },
        learningRecords: {
          where: { userId },
          select: { isCompleted: true, duration: true },
        },
      } as any,
    });

    return (nodes as any[]).map((node) => {
      const record = node.learningRecords?.[0];
      return {
        id: node.id,
        title: node.nodeName,
        description: node.description ?? '',
        estimatedDuration: node.estimatedDuration ?? 0,
        duration: record?.duration ?? 0,
        isCompleted: record?.isCompleted ?? false,
        // 额外返回 studentIds 数组，方便教师端查看分配人数
        studentIds: node.students?.map((s) => s.id) || [],
        // 标记当前用户是否是创建者（可选，方便前端 UI 处理）
        isCreator: node.creatorId === userId,
      };
    });
  }

  async getCourse(courseId: number): Promise<any> {
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
        estimatedDuration: true,
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
  async getCourseKnowledgeGraph(courseId: number): Promise<any> {
    const courses = await this.prisma.node.findMany({
      where: { id: courseId, parentNodeId: null, nodeLevel: NodeLevel.LEVEL1 },
      select: this.buildGraphSelect(),
    });

    if (!courses.length) return [];
    const course = courses[0];

    const level4Nodes = this.collectLevel4Nodes(course);
    if (level4Nodes.length > 0) {
      const nodeIds = level4Nodes.map((n) => n.id);
      const signedUrls = await this.cosService.getMultipleSignedUrls(nodeIds);

      const allResources = await this.prisma.resource.findMany({
        where: { nodeId: { in: nodeIds } },
        orderBy: { id: 'asc' },
      });

      const nodeResourcesMap = new Map<number, any[]>();
      allResources.forEach((res) => {
        if (!nodeResourcesMap.has(res.nodeId))
          nodeResourcesMap.set(res.nodeId, []);
        nodeResourcesMap.get(res.nodeId).push(res);
      });

      let urlIndex = 0;
      level4Nodes.forEach((node) => {
        const resources = nodeResourcesMap.get(node.id) || [];
        node.resource = resources.map((res, idx) => ({
          ...res,
          signedUrl: signedUrls[urlIndex + idx] ?? null,
        }));
        urlIndex += resources.length;
      });
    }
    return courses;
  }

  // ==========================================
  // 6. 辅助工具
  // ==========================================

  private async validateUser(id: number) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new HttpException('用户不存在', HttpStatus.NOT_FOUND);
    return user;
  }

  private async validateNode(id: number) {
    const node = await this.prisma.node.findUnique({ where: { id } });
    if (!node) throw new HttpException('节点不存在', HttpStatus.NOT_FOUND);
    return node;
  }

  private async findRootNode(node: any): Promise<any> {
    if (node.parentNodeId === null) return node;
    const parent = await this.prisma.node.findUnique({
      where: { id: node.parentNodeId },
    });
    return this.findRootNode(parent);
  }

  private validateNodeHierarchy(parentLevel: NodeLevel, childLevel: NodeLevel) {
    const order = {
      [NodeLevel.LEVEL1]: 1,
      [NodeLevel.LEVEL2]: 2,
      [NodeLevel.LEVEL3]: 3,
      [NodeLevel.LEVEL4]: 4,
    };
    if (order[childLevel] !== order[parentLevel] + 1) {
      throw new HttpException('层级关系不正确', HttpStatus.BAD_REQUEST);
    }
  }

  private validateNodeHierarchyForUpdate(
    currentNode: any,
    newLevel: NodeLevel,
  ) {
    if (currentNode.parentNodeId === null && newLevel !== NodeLevel.LEVEL1)
      throw new HttpException('根节点不能修改层级', HttpStatus.BAD_REQUEST);
    if (currentNode.parentNodeId !== null && newLevel === NodeLevel.LEVEL1)
      throw new HttpException('子节点不能修改为根节点', HttpStatus.BAD_REQUEST);
  }

  private buildCourseTree(node: any) {
    return {
      id: node.id,
      nodeName: node.nodeName,
      nodeLevel: node.nodeLevel,
      description: node.description,
      estimatedDuration: node.estimatedDuration,
      // 将隐式关联的 students 对象数组转回 studentIds 数组给前端
      studentIds: node.students?.map((s: any) => s.id) || [],
      childNodes:
        node.childNodes?.map((child: any) => this.buildCourseTree(child)) || [],
    };
  }

  private collectLevel4Nodes(node: any): any[] {
    let nodes: any[] = node.nodeLevel === NodeLevel.LEVEL4 ? [node] : [];
    if (node.childNodes) {
      for (const child of node.childNodes) {
        nodes = nodes.concat(this.collectLevel4Nodes(child));
      }
    }
    return nodes;
  }

  private getNodeBasicSelect() {
    return {
      id: true,
      nodeName: true,
      nodeLevel: true,
      description: true,
      estimatedDuration: true,
      creatorId: true,
      parentNodeId: true,
      createdAt: true,
      // 隐式关联：如果需要返回学生 ID，需要 select 关联字段
      students: {
        select: {
          id: true,
        },
      },
    } as any;
  }

  private buildGraphSelect() {
    const subSelect = (level: number) => ({
      select: {
        id: true,
        nodeName: true,
        nodeLevel: true,
        description: true,
        estimatedDuration: true,
        ...(level < 4
          ? { childNodes: subSelect(level + 1) }
          : {
              resource: {
                select: {
                  id: true,
                  resourceName: true,
                  resourceType: true,
                  fileSize: true,
                  fileFormat: true,
                },
              },
            }),
      },
    });
    return {
      id: true,
      nodeName: true,
      nodeLevel: true,
      description: true,
      estimatedDuration: true,
      students: { select: { id: true } },
      childNodes: subSelect(2),
    };
  }
}
