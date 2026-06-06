// supabase/functions/world-engine-tick/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import dayjs from "https://esm.sh/dayjs@1.11.10";
import utc from "https://esm.sh/dayjs@1.11.10/plugin/utc";
import timezone from "https://esm.sh/dayjs@1.11.10/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.tz.setDefault("Asia/Shanghai");

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apiKey, content-type',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const beijingTime = dayjs().tz("Asia/Shanghai").format('YYYY-MM-DD HH:mm:ss');

    const simulationPrompt = `
[CRITICAL SYSTEM OVERRIDE]
当前时间：${beijingTime}
你是一个世界环境痕迹生成器。你不需要描述故事，只能根据废土避难所的底层逻辑输出结构化 JSON 数据。
严格输出包含 1-2 个对象的数组，用于更新墙壁的环境痕迹。
格式范例：
[
  { "trace_text": "墙角有些新鲜的水渍" },
  { "trace_text": "空气中弥漫着淡淡的铁锈味" }
]
`;

    const openAiApiKey = Deno.env.get('OPENAI_API_KEY')
    const llmResponse = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: 'You must output ONLY valid JSON array. No markdown.' },
          { role: 'user', content: simulationPrompt }
        ],
      }),
    })

    if (!llmResponse.ok) throw new Error(`LLM API Failed`);

    const llmResult = await llmResponse.json();
    const traces = JSON.parse(llmResult.choices[0].message.content);

    // 斩断复杂的 RPC，直接写入墙壁实体的 components 中
    const currentTime = dayjs().tz("Asia/Shanghai").valueOf(); // 存为东八区时间戳

    const { error: upsertError } = await supabaseClient
      .from('world_entities')
      .upsert({
        id: 'global_wall_001', // 强行指定墙壁的 ID
        entity_type: 'attachment',
        entity_components: { traces: traces.map((t: any) => ({ text: t.trace_text, created_at: currentTime })) },
        updated_at: new Date().toISOString()
      });

    if (upsertError) throw upsertError;

    return new Response(JSON.stringify({ success: true, traces }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error) {
    const e = error as Error;
    console.error(`[World Engine Fatal Error]:`, e.message);
    return new Response(JSON.stringify({ success: false, error: e.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})