/**
 * AI分析模式提示词模板
 * 用于生成基于习题内容和用户答题表现的学习分析报告
 */

export const ANALYSIS_PROMPT_TEMPLATE = `
你是一位专业的学习分析师和贴心的学业导师。请基于以下提供的学习数据，为用户生成一份深入、个性化的学习分析报告。

1. 【习题内容】
{{quizContent}}

2. 【用户答题表现】
{{userPerformance}}

3. 【分析与报告要求】
   1.1. **知识薄弱点定位**：分析用户的知识掌握情况，精准指出用户在哪些特定知识点、概念或技能上存在薄弱环节。
   
   1.2. **错题深度解析**：针对用户做错的题目，提供详细的逻辑分析、考查点说明及正确的解题思路。
   
   1.3. **针对性改进建议**：给出具体的学习策略，帮助用户克服上述薄弱点。
   
   1.4. **课程资源推荐**：根据分析结果，为用户推荐下一步应当复习或进阶学习的课程资源。
   
   1.5. **下一步学习指导**：给出明确的练习方向和进阶建议。
   
   1.6. **语气与格式**：语言要亲切、鼓励，避免严厉批评。请以专业但友好的语气回答，确保内容层次分明、结构清晰、文本可读性好。使用 Markdown 格式（标题、加粗、列表），使报告在界面上易于阅读。



注意：请直接开始你的分析报告，不要在开头或结尾出现“希望能帮你”、“随时联系我”等引导性废话。
`;

/**
 * 构建分析提示词的辅助函数
 * @param context 包含 nodeId, quizData, userRecord 的上下文对象
 * @returns 格式化后的完整提示词
 */
export function buildAnalysisPrompt(context: {
  nodeId: number;
  quizData: any[];
  userRecord: any[];
}): string {
  const { nodeId, quizData, userRecord } = context;

  // 1. 构建习题内容 (保留原逻辑，并增加正确答案以供AI精准解析)
  let quizContent = '';
  if (quizData && quizData.length > 0) {
    quizContent = quizData
      .map((q: any) => {
        let question = `题目：${q.exerciseTitle || '未命名题目'}\n内容：${q.exerciseContent}\n类型：${q.type}\n`;

        if (q.options && q.options.length > 0) {
          question += `选项：\n${q.options
            .map(
              (opt: any, index: number) =>
                `${String.fromCharCode(65 + index)}. ${opt.content}`,
            )
            .join('\n')}\n`;
        }

        // 保持逻辑完整性：如果数据中有正确答案，则告知AI，防止AI推断错误
        if (q.answer || q.correctAnswer) {
          question += `标准答案：${q.answer || q.correctAnswer}\n`;
        }

        if (q.score) {
          question += `分值：${q.score}分\n`;
        }

        return question;
      })
      .join('\n---\n');
  } else {
    quizContent = '该节点暂无习题内容。';
  }

  // 2. 构建用户表现内容 (保留原逻辑)
  let performanceContent = '';
  if (userRecord && userRecord.length > 0) {
    performanceContent = userRecord
      .map((record: any) => {
        const quiz = quizData.find((q: any) => q.id === record.exerciseId);
        const quizTitle = quiz
          ? quiz.exerciseTitle
          : `习题ID: ${record.exerciseId}`;
        const userAnswer = record.selectedOptionId
          ? `选项ID: ${record.selectedOptionId}`
          : record.blankAnswer
            ? `填空答案: "${record.blankAnswer}"`
            : '未作答';
        const correctStatus = record.isCorrect ? '正确' : '错误';

        return `${quizTitle} - 用户答案: ${userAnswer}, 结果: ${correctStatus}, 得分: ${record.score}/${quiz?.score || 0}`;
      })
      .join('\n');
  } else {
    performanceContent = '用户暂无答题记录。';
  }

  // 3. 替换模板中的占位符
  return ANALYSIS_PROMPT_TEMPLATE.replace('{{nodeId}}', nodeId.toString())
    .replace('{{quizContent}}', quizContent)
    .replace('{{userPerformance}}', performanceContent);
}
