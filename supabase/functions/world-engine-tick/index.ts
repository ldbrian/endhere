// supabase/functions/world-engine-tick/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apiKey, content-type',
}

// 修复点 1：显式声明 req 的类型为 Request，消除 ts(7006)
serve(async (req: Request) => {
  // 1. 处理 CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 2. 初始化 Supabase (Service Role 越权操作，因为这是上帝引擎)
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 3. 抓取 (T-1) 时刻的切片
    const { data: currentEntities, error: fetchError } = await supabaseClient
      .from('world_entities')
      .select(`
        id,
        name,
        entity_type,
        entity_components (component_type, data)
      `)

    if (fetchError) throw fetchError

    // 获取当前的东八区时间与星期，作为世界的物理时间锚点
    const now = new Date();
    const beijingTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    const timeString = beijingTime.toLocaleString('zh-CN', { timeZone: 'UTC', hour12: false });
    const weekday = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][beijingTime.getUTCDay()];

    // 4. 构建克制的无情绪 Prompt (注入时间锚点)
    const simulationPrompt = {
      action: "SIMULATE_WORLD_TICK",
      current_real_time: `${timeString} (${weekday})`, 
      current_state: currentEntities,
      // 核心法则升级：强制要求输出物理痕迹
      rules: "无形观测者原则：世界因其内在逻辑运转，严禁主观介入。必须结合实体的 memory(记忆) 和 relationship(关系) 推演状态。核心法则：实体行动后，必须在对应的 location(地点) 的 inventory(物品栏) 中留下【物理痕迹】（例如：修理收音机留下的废电线、画过涂鸦的废纸、留给猫的半根火腿肠等）。推演结果必须为JSON。",
      required_output_format: {
        tick: "number",
        global_summary: "string",
        component_updates: [
          { entity_id: "uuid", component_type: "string", data: "object" }
        ]
      }
    }

    // 5. 调用大模型 (适配 DeepSeek 的 JSON 输出要求)
    const openAiApiKey = Deno.env.get('OPENAI_API_KEY')
    const llmResponse = await fetch('https://api.deepseek.com/v1/chat/completions', { // 确保这里是你 DeepSeek 的真实 API 地址
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'deepseek-chat', // 确认你的模型名是否为 deepseek-chat 或 deepseek-coder
        // 移除 response_format: { type: "json_object" }，改用 System Prompt 强制要求
        messages: [
          { 
            role: 'system', 
            content: 'You are the unfeeling physics engine of a world simulation. You must output ONLY valid JSON. Do not include any markdown formatting or explanations.' 
          },
          { role: 'user', content: JSON.stringify(simulationPrompt) }
        ],
      }),
    })

    if (!llmResponse.ok) {
        throw new Error(`LLM API Failed: ${await llmResponse.text()}`);
    }

    const llmResult = await llmResponse.json()
    const simulationResult = JSON.parse(llmResult.choices[0].message.content)

    // 6. 核心闭环：调用数据库层面的 RPC 事务进行原子性落盘
    const { error: rpcError } = await supabaseClient.rpc('process_world_tick', {
      p_tick_version: simulationResult.tick,
      p_summary: simulationResult.global_summary,
      p_raw_payload: simulationResult,
      p_components_update: simulationResult.component_updates 
    })

    if (rpcError) throw rpcError;

    console.info(`[World Engine] Tick ${simulationResult.tick} completed.`);

    return new Response(
      JSON.stringify({ success: true, message: `Tick ${simulationResult.tick} simulated successfully.` }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    // 修复点 2：显式断言 error 为 Error 对象，消除 ts(18046)
    const e = error as Error;
    console.error(`[World Engine Fatal Error]:`, e.message);
    // TODO: 接入飞书/钉钉 Webhook 告警
    return new Response(
      JSON.stringify({ success: false, error: e.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})