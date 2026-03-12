/**
 * AI分析模式提示词模板
 * 用于生成基于习题内容和用户答题表现的学习分析报告
 *
 * 使用说明：
 * - 将此模板中的占位符替换为实际数据
 * - 可根据需要调整分析要求和输出格式
 * - 保持专业但友好的语气
 */

export const ANALYSIS_PROMPT_TEMPLATE = `
你是一位专业的学习分析师，请基于以下学习数据为用户提供个性化的学习分析和建议。

1. 【习题内容】
{{quizContent}}

2. 【用户答题表现】
{{userPerformance}}

3. 【分析要求】
   1.1. 分析用户的知识掌握情况和薄弱环节

   1.2. 针对错题提供详细的解析和学习建议  

   1.3. 给出下一步的学习指导和练习建议

   1.4. 语言要亲切、鼓励，避免过于严厉的批评

   1.5. 如果用户表现优秀，也要给予肯定和进阶建议
   
请以专业但友好的语气回答，确保内容层次分明、结构清晰。使用适当的标题、序号、空格和换行，使分析报告易于阅读和理解，帮助用户更好地掌握相关知识点.
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

  // 构建习题内容
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

        if (q.score) {
          question += `分值：${q.score}分\n`;
        }

        return question;
      })
      .join('\n---\n');
  } else {
    quizContent = '该节点暂无习题内容。';
  }

  // 构建用户表现内容
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

  // 替换模板中的占位符
  return ANALYSIS_PROMPT_TEMPLATE.replace('{{nodeId}}', nodeId.toString())
    .replace('{{quizContent}}', quizContent)
    .replace('{{userPerformance}}', performanceContent);
}
