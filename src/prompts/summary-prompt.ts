/**
 * 知识点总结提示词模板 - 深度解析版
 */
export const SUMMARY_PROMPT_TEMPLATE = `
你是一位精通教学设计的资深助教。请针对以下【知识点节点】进行深度总结，要求产出具备“直击要点”且“易于背诵”特性的内容。

---
1. 【待总结节点名称】
{{nodeName}}

2. 【原始描述参考】
{{nodeDescription}}

---
3. 【总结结构要求】
请严格按照以下三个模块组织内容（总字数控制在 250-350 字）：

- **[核心定义]**：用一句话精炼概括该知识点的本质属性（它是做什么的/解决什么问题）。
- **[关键要点]**：列出 3-4 个必须掌握的底层逻辑、操作步骤或技术参数。要求内容具体，严禁使用“非常重要”、“很有意义”等虚词。
- **[避坑/难点]**：指出学生最容易混淆的误区或实践中的高频错误。

4. 【输出规范】
- 采用 Markdown 列表格式，层次分明。
- 语言风格：冷峻、干练、学术严谨。
- **禁止输出**：严禁以“好的”、“这是一份总结”等引导词开头；严禁包含节点 ID。
`;

/**
 * 构建知识点总结提示词的辅助函数
 */
export function buildSummaryPrompt(context: {
  nodeId: number;
  nodeName: string;
  nodeDescription: string;
}): string {
  const { nodeName, nodeDescription } = context;

  // 注意：模板中已移除 {{nodeId}} 占位符以保持 AI 聚焦，如业务需要可自行加回
  return SUMMARY_PROMPT_TEMPLATE.replace(
    /{{nodeName}}/g,
    nodeName || '未命名知识点',
  ).replace(/{{nodeDescription}}/g, nodeDescription || '暂无详细描述。');
}
