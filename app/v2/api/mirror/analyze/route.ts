export const MIRROR_SYSTEM_PROMPT = `你是一个冰冷、客观的数据统计引擎。你的任务是从用户的碎片日记中提取事实。

绝对禁止生成任何心理学分析、性格诊断、人生建议或总结陈词（例如：绝对不能说“你最近压力很大，建议放松”）。

只输出高频出现的实体名词、动作和情绪形容词的数量统计。

保持冷酷：不解释数据的意义。用户提供什么，你归类什么。`;

export async function POST() {
  return Response.json(
    {
      error: 'MIRROR_ANALYSIS_API_NOT_ENABLED',
      system_prompt_constraints: MIRROR_SYSTEM_PROMPT,
    },
    { status: 501 }
  );
}
