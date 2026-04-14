import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NodeLevel, Role } from '@prisma/client';
import { TencentCosService } from '../common/tencent-cos/tencent-cos.service';
import { AssignCourseDto } from './dto/assign-course.dto';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';

/**
 * 课程服务类
 * 负责处理课程相关的业务逻辑，包括节点管理、课程分配、知识图谱构建等功能
 */
@Injectable()
export class CourseService {
  constructor(
    private prisma: PrismaService,
    private cosService: TencentCosService,
  ) {}

  // ================= [1. 节点 CRUD] =================

  /**
   * 创建课程节点
   * @param userId 当前用户ID
   * @param dto 创建课程节点的数据传输对象
   * @returns 创建的节点信息
   */
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
        throw new HttpException('仅限教师创建课程', 403);
      if (parentNodeId) throw new HttpException('根节点不能有父节点', 400);
    } else {
      if (!parentNodeId) throw new HttpException('子节点缺失父节点', 400);
      const parent = await this.validateNode(parentNodeId);
      this.validateNodeHierarchy(parent.nodeLevel, nodeLevel);
    }

    const maxOrderNode = await this.prisma.node.findFirst({
      where: { parentNodeId: parentNodeId || null },
      orderBy: { order: 'desc' },
    });

    return this.prisma.node.create({
      data: {
        nodeName,
        nodeLevel,
        description,
        estimatedDuration,
        order: (maxOrderNode?.order || 0) + 1,
        creatorId: nodeLevel === NodeLevel.LEVEL1 ? userId : null,
        parentNodeId: parentNodeId || null,
      },
      select: this.getNodeBasicSelect(),
    });
  }

  /**
   * 更新课程节点
   * @param userId 当前用户ID
   * @param nodeId 要更新的节点ID
   * @param dto 更新课程节点的数据传输对象
   * @returns 更新后的节点信息
   */
  async updateNode(
    userId: number,
    nodeId: number,
    dto: UpdateCourseDto,
  ): Promise<any> {
    const nodeToUpdate = await this.validateNode(nodeId);
    if ((await this.findRootNode(nodeToUpdate)).creatorId !== userId)
      throw new HttpException('无权修改', 403);

    if (dto.nodeLevel)
      this.validateNodeHierarchyForUpdate(nodeToUpdate, dto.nodeLevel);
    if (dto.parentNodeId !== undefined)
      throw new HttpException('不支持直接修改父子关系', 400);

    return this.prisma.node.update({
      where: { id: nodeId },
      data: dto,
      select: this.getNodeBasicSelect(),
    });
  }

  /**
   * 删除课程节点（递归删除所有子节点）
   * @param userId 当前用户ID
   * @param nodeId 要删除的节点ID
   * @returns 删除操作结果
   */
  async deleteNode(userId: number, nodeId: number): Promise<any> {
    const node = await this.validateNode(nodeId);
    if ((await this.findRootNode(node)).creatorId !== userId)
      throw new HttpException('无权删除', 403);

    await this.prisma.$transaction(async (tx) => {
      const recursiveDelete = async (id: number) => {
        const children = await tx.node.findMany({
          where: { parentNodeId: id },
          select: { id: true },
        });
        await Promise.all(children.map((c) => recursiveDelete(c.id)));
        await tx.node.delete({ where: { id } });
      };
      await recursiveDelete(nodeId);
    });
    return { success: true };
  }

  // ================= [2. 课程分配 & 查询] =================

  /**
   * 将课程分配给学生
   * @param teacherId 教师ID
   * @param assignCourseDto 包含课程ID和学生ID列表的分配数据
   * @returns 分配操作结果
   */
  async assignCourseToStudents(
    teacherId: number,
    { courseId, studentIds }: AssignCourseDto,
  ): Promise<any> {
    const course = await this.prisma.node.findUnique({
      where: { id: courseId, nodeLevel: NodeLevel.LEVEL1 },
    });
    if (!course || course.creatorId !== teacherId)
      throw new HttpException('权限不足或课程不存在', 404);

    const validStudents = await this.prisma.user.count({
      where: { id: { in: studentIds }, role: Role.student },
    });
    if (validStudents !== studentIds.length)
      throw new HttpException('包含无效学生ID', 400);

    await this.prisma.node.update({
      where: { id: courseId },
      data: { students: { connect: studentIds.map((id) => ({ id })) } } as any,
    });
    return { success: true };
  }

  /**
   * 获取用户的所有课程列表
   * - 教师：获取自己创建的课程
   * - 学生：获取已分配给自己的课程
   * @param userId 用户ID
   * @returns 课程列表
   */
  async findAllCourses(userId: number): Promise<any> {
    const user = await this.validateUser(userId);
    const where =
      user.role === Role.teacher
        ? { parentNodeId: null, nodeLevel: NodeLevel.LEVEL1, creatorId: userId }
        : {
            parentNodeId: null,
            nodeLevel: NodeLevel.LEVEL1,
            students: { some: { id: userId } },
          };

    const nodes = await this.prisma.node.findMany({
      where,
      select: {
        ...this.getNodeBasicSelect(),
        learningRecords: {
          where: { userId },
          select: { isCompleted: true, duration: true },
        },
      } as any,
    });

    return nodes.map((node: any) => ({
      id: node.id,
      title: node.nodeName,
      description: node.description || '',
      estimatedDuration: node.estimatedDuration || 0,
      duration: node.learningRecords?.[0]?.duration || 0,
      isCompleted: node.learningRecords?.[0]?.isCompleted || false,
      studentIds: node.students?.map((s) => s.id) || [],
      isCreator: node.creatorId === userId,
    }));
  }

  // ================= [3. 知识图谱与资源处理] =================

  /**
   * 获取课程知识图谱
   * 包含完整的层级结构和资源信息，并为资源生成临时访问URL
   * @param courseId 课程ID
   * @returns 课程知识图谱数据
   */
  async getCourseKnowledgeGraph(courseId: number): Promise<any> {
    const courses = await this.prisma.node.findMany({
      where: { id: courseId, parentNodeId: null, nodeLevel: NodeLevel.LEVEL1 },
      select: this.buildGraphSelect(),
    });
    if (!courses.length) return [];

    const course = courses[0];
    const level4Nodes = this.collectLevel4Nodes(course);

    if (level4Nodes.length) {
      const nodeIds = level4Nodes.map((n) => n.id);
      const [nodeUrlMap, allResources] = await Promise.all([
        this.cosService.getMultipleSignedUrls(nodeIds),
        this.prisma.resource.findMany({
          where: { nodeId: { in: nodeIds } },
          orderBy: { id: 'asc' },
        }),
      ]);

      const nodeResMap = new Map<number, any[]>();
      allResources.forEach((res) => {
        if (!nodeResMap.has(res.nodeId)) nodeResMap.set(res.nodeId, []);
        nodeResMap.get(res.nodeId).push(res);
      });

      level4Nodes.forEach((node) => {
        const urls = nodeUrlMap.get(node.id) || [];
        node.resource = (nodeResMap.get(node.id) || []).map((res, idx) => ({
          ...res,
          signedUrl: urls[idx] || null,
        }));
      });
    }
    return courses;
  }

  // ================= [4. 辅助工具] =================

  /**
   * 验证用户是否存在
   * @param id 用户ID
   * @returns 用户信息
   */
  private async validateUser(id: number) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new HttpException('用户不存在', 404);
    return user;
  }

  /**
   * 验证节点是否存在
   * @param id 节点ID
   * @returns 节点信息
   */
  private async validateNode(id: number) {
    const node = await this.prisma.node.findUnique({ where: { id } });
    if (!node) throw new HttpException('节点不存在', 404);
    return node;
  }

  /**
   * 递归查找节点的根节点
   * @param node 当前节点
   * @returns 根节点信息
   */
  private async findRootNode(node: any): Promise<any> {
    return node.parentNodeId === null
      ? node
      : this.findRootNode(
          await this.prisma.node.findUnique({
            where: { id: node.parentNodeId },
          }),
        );
  }

  /**
   * 验证节点层级关系是否正确
   * @param parentLevel 父节点层级
   * @param childLevel 子节点层级
   */
  private validateNodeHierarchy(p: NodeLevel, c: NodeLevel) {
    const order = {
      [NodeLevel.LEVEL1]: 1,
      [NodeLevel.LEVEL2]: 2,
      [NodeLevel.LEVEL3]: 3,
      [NodeLevel.LEVEL4]: 4,
    };
    if (order[c] !== order[p] + 1)
      throw new HttpException('层级关系不正确', 400);
  }

  /**
   * 验证节点更新时的层级关系
   * @param node 当前节点
   * @param nextLevel 目标层级
   */
  private validateNodeHierarchyForUpdate(node: any, next: NodeLevel) {
    if (!node.parentNodeId && next !== NodeLevel.LEVEL1)
      throw new HttpException('根节点禁改层级', 400);
    if (node.parentNodeId && next === NodeLevel.LEVEL1)
      throw new HttpException('子节点禁升根节点', 400);
  }

  /**
   * 递归收集所有四级节点
   * @param node 当前节点
   * @returns 四级节点数组
   */
  private collectLevel4Nodes(node: any): any[] {
    const current = node.nodeLevel === NodeLevel.LEVEL4 ? [node] : [];
    return [
      ...current,
      ...(node.childNodes?.flatMap((c) => this.collectLevel4Nodes(c)) || []),
    ];
  }

  /**
   * 构建知识图谱查询的选择器
   * @returns 查询选择器配置
   */
  private buildGraphSelect() {
    const sub = (level: number) => ({
      select: {
        id: true,
        nodeName: true,
        nodeLevel: true,
        description: true,
        estimatedDuration: true,
        ...(level < 4
          ? { childNodes: sub(level + 1) }
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
    return { ...this.getNodeBasicSelect(), childNodes: sub(2) };
  }

  /**
   * 获取节点基本信息的选择器
   * @returns 基本信息选择器配置
   */
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
      students: { select: { id: true } },
    };
  }

  // 原 getCourse 逻辑已包含在 KnowledgeGraph 查询中，若需保留独立方法：
  /**
   * 获取单个课程信息（包含完整知识图谱结构）
   * @param id 课程ID
   * @returns 课程信息
   */
  async getCourse(id: number) {
    return this.prisma.node.findMany({
      where: { id, parentNodeId: null, nodeLevel: NodeLevel.LEVEL1 },
      select: this.buildGraphSelect(),
    });
  }
}
