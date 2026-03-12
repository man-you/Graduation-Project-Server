/**
 * 知识点总结提示词模板
 * 用于生成基于节点名称和描述的知识点总结
 */

export const SUMMARY_PROMPT_TEMPLATE = `
你是一位专业的课程助教，请根据以下节点信息，生成一段简洁、准确、适合学生复习的知识点总结。

1. 【节点名称】
{{nodeName}}

2. 【节点描述】
{{nodeDescription}}

3. 【总结要求】
   3.1. 提取核心概念和关键知识点
   
   3.2. 用简洁明了的语言进行概括
   
   3.3. 突出重点和难点内容
   
   3.4. 保持逻辑清晰，层次分明
   
   3.5. 总结长度控制在200-300字左右
   
请直接输出知识点总结内容，不要包含额外的解释、标题或其他无关信息。
`;

/**
 * 构建知识点总结提示词的辅助函数
 * @param context 包含 nodeId, nodeName, nodeDescription 的上下文对象
 * @returns 格式化后的完整提示词
 */
export function buildSummaryPrompt(context: {
  nodeId: number;
  nodeName: string;
  nodeDescription: string;
}): string {
  const { nodeId, nodeName, nodeDescription } = context;

  // 替换模板中的占位符
  return SUMMARY_PROMPT_TEMPLATE
    .replace('{{nodeId}}', nodeId.toString())
    .replace('{{nodeName}}', nodeName || '未命名节点')
    .replace('{{nodeDescription}}', nodeDescription || '该节点暂无描述信息。');
}