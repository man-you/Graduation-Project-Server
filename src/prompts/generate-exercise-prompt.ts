/**
 * AI生成习题提示词模板
 * 用于根据用户自定义提示词和指定题型生成单道符合数据结构的习题
 */

export const GENERATE_EXERCISE_PROMPT_TEMPLATE = `
你是一位专业的课程出题专家，请根据以下用户要求和指定题型，生成1道高质量的习题。

1. 【用户题目要求】
{{userPrompt}}

2. 【题型要求】
{{exerciseTypeText}}

3. 【出题要求】
   3.1. 只生成1道习题，严格按照指定题型要求
   
   3.2. 单选题(SINGLE_CHOICE)必须包含4个选项，其中只有1个正确答案
   
   3.3. 判断题(TRUE_FALSE)必须包含2个选项："对"和"错"，明确标示正确答案
   
   3.4. 填空题(FILL_BLANK)不需要选项，但需要提供标准答案(blankAnswer)
   
   3.5. 题目必须有明确的题目标题(exerciseTitle)、题目内容(exerciseContent)和分值(score)
   
   3.6. 分值统一设置为10分
   
   3.7. 题目难度适中，覆盖知识点的核心概念

4. 【输出格式要求】
   4.1. 严格按照以下JSON格式输出，不要包含任何其他文字或解释：
   {
     "exerciseTitle": "题目标题",
     "exerciseContent": "题目内容",
     "type": "{{exerciseType}}",
     "score": 10,
     "blankAnswer": {{blankAnswerValue}},
     "options": [
       {
         "content": "选项内容",
         "isCorrect": true/false
       }
     ]
   }
   
   4.2. 单选题和判断题必须包含options数组，填空题的options应为空数组[]
   
   4.3. 确保JSON格式正确，可以被直接解析

请严格按照上述要求生成习题。
`;

/**
 * 构建生成习题提示词的辅助函数
 * @param context 包含 userPrompt, exerciseType 的上下文对象
 * @returns 格式化后的完整提示词
 */
export function buildGenerateExercisePrompt(context: {
  userPrompt: string;
  exerciseType: 'SINGLE_CHOICE' | 'TRUE_FALSE' | 'FILL_BLANK';
}): string {
  const { userPrompt, exerciseType } = context;

  // 根据题型设置不同的要求文本和空白答案值
  let exerciseTypeText = '';
  let blankAnswerValue = 'null';

  switch (exerciseType) {
    case 'SINGLE_CHOICE':
      exerciseTypeText = '题型：单选题(SINGLE_CHOICE)';
      break;
    case 'TRUE_FALSE':
      exerciseTypeText = '题型：判断题(TRUE_FALSE)';
      break;
    case 'FILL_BLANK':
      exerciseTypeText = '题型：填空题(FILL_BLANK)';
      blankAnswerValue = '"标准答案"';
      break;
    default:
      exerciseTypeText = '题型：未知';
  }

  // 替换模板中的占位符
  return GENERATE_EXERCISE_PROMPT_TEMPLATE
    .replace('{{userPrompt}}', userPrompt || '请根据相关知识点生成一道题目')
    .replace('{{exerciseType}}', exerciseType)
    .replace('{{exerciseTypeText}}', exerciseTypeText)
    .replace('{{blankAnswerValue}}', blankAnswerValue);
}