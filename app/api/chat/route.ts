import { NextRequest } from "next/server";

const DIFY_CHAT_URL = "https://api.dify.ai/v1/chat-messages";

export async function POST(request: NextRequest) {
  const apiKey = process.env.DIFY_API_KEY;

  if (!apiKey) {
    return Response.json(
      { error: "服务器未配置 DIFY_API_KEY" },
      { status: 500 }
    );
  }

  let body: {
    query?: string;
    conversationId?: string;
    conversation_id?: string;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "请求体不是有效 JSON" }, { status: 400 });
  }

  const query = typeof body.query === "string" ? body.query.trim() : "";
  if (!query) {
    return Response.json({ error: "缺少 query" }, { status: 400 });
  }

  const conversationId =
    (typeof body.conversationId === "string" ? body.conversationId.trim() : "") ||
    (typeof body.conversation_id === "string" ? body.conversation_id.trim() : "");

  const difyResponse = await fetch(DIFY_CHAT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      inputs: {},
      query,
      response_mode: "streaming",
      conversation_id: conversationId || "",
      user: "child-mvp-user",
    }),
  });

  if (!difyResponse.ok || !difyResponse.body) {
    const detail = await difyResponse.text();
    return Response.json(
      { error: "Dify 调用失败", detail },
      { status: difyResponse.status || 502 }
    );
  }

  return new Response(difyResponse.body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
