import { GoogleGenerativeAI } from "@google/generative-ai";

function extractJsonArray(text: string): string[] | null {
  // Try direct parse first
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed;
  } catch {}

  // Strip markdown code fences
  const stripped = text.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim();
  try {
    const parsed = JSON.parse(stripped);
    if (Array.isArray(parsed)) return parsed;
  } catch {}

  // Extract JSON array via regex
  const match = text.match(/\[[\s\S]*\]/);
  if (match) {
    try {
      const parsed = JSON.parse(match[0]);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
  }

  return null;
}

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "your_gemini_api_key_here") {
    return Response.json(
      { error: "GEMINI_API_KEY is not configured in .env.local" },
      { status: 500 }
    );
  }

  let articleText: string;
  try {
    const body = await request.json();
    articleText = body.articleText;
    if (!articleText || typeof articleText !== "string") {
      return Response.json({ error: "articleText is required" }, { status: 400 });
    }
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const prompt = `You are an English teacher. Based on the following article, generate exactly 30 comprehension questions to help students understand and think critically about the content. Return ONLY a valid JSON array of 30 strings, with no markdown, no explanation, no code block — just the raw JSON array.

Article:
${articleText.slice(0, 8000)}`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    const questions = extractJsonArray(text);

    if (!questions || questions.length === 0) {
      return Response.json(
        { error: `Unexpected Gemini response format: ${text.slice(0, 200)}` },
        { status: 502 }
      );
    }

    return Response.json({ questions: questions.slice(0, 30) });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 502 });
  }
}
