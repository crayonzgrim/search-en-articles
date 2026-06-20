import { extract } from "@extractus/article-extractor";
import { createHash } from "crypto";

export type Article = {
  id: string;
  title: string;
  content: string;
  url: string;
  publishedAt: string;
  source: string;
};

type NewsApiArticle = {
  title: string;
  description: string | null;
  url: string;
  publishedAt: string;
  source: { name: string };
};

function decodeHtmlEntities(text: string): string {
  const namedEntities: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    hellip: "…",
    ldquo: "“",
    lsquo: "‘",
    nbsp: " ",
    quot: '"',
    rdquo: "”",
    rsquo: "’",
    lt: "<",
  };

  return text.replace(/&(#(?:x[0-9a-f]+|\d+)|[a-z]+);/gi, (entity, code: string) => {
    if (code.startsWith("#x")) return String.fromCodePoint(Number.parseInt(code.slice(2), 16));
    if (code.startsWith("#")) return String.fromCodePoint(Number.parseInt(code.slice(1), 10));
    return namedEntities[code.toLowerCase()] ?? entity;
  });
}

function htmlToParagraphText(html: string): string {
  const paragraphs = decodeHtmlEntities(
    html
      .replace(/<\s*(?:script|style|video)\b[^>]*>[\s\S]*?<\s*\/\s*(?:script|style|video)\s*>/gi, "")
      .replace(/<\s*br\s*\/?\s*>/gi, "\n")
      .replace(/<\s*\/?\s*(?:p|div|article|section|blockquote|h[1-6])\b[^>]*>/gi, "\n\n")
      .replace(/<\s*li\b[^>]*>/gi, "\n• ")
      .replace(/<\s*\/\s*li\s*>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  )
    .split(/\n+/)
    .map((paragraph) => paragraph.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  // Article extractors can include video controls, captions, bylines and dates
  // before the actual story. Start at the first sentence-like body paragraph.
  const bodyStart = paragraphs.findIndex(
    (paragraph) => paragraph.length >= 90 && /[.!?]["'”’)]?$/.test(paragraph)
  );
  const bodyParagraphs = bodyStart >= 0 ? paragraphs.slice(bodyStart) : paragraphs;

  return bodyParagraphs
    .filter(
      (paragraph) =>
        !/^play$/i.test(paragraph) &&
        !/^\W+$/u.test(paragraph) &&
        !/^\d+\s+min\s+read(?:\s+\d+\s+min\s+read)*$/i.test(paragraph)
    )
    .join("\n\n");
}

async function extractContent(url: string, fallback: string): Promise<string> {
  try {
    const result = await extract(url);
    if (result?.content) {
      return htmlToParagraphText(result.content);
    }
  } catch {
    // Silent fallback
  }
  return fallback ?? "";
}

async function fetchNewsApiArticles(
  apiKey: string,
  endpoint: "top-headlines" | "everything",
  params: Record<string, string>
): Promise<NewsApiArticle[]> {
  const query = new URLSearchParams({ pageSize: "10", apiKey, ...params });
  const res = await fetch(`https://newsapi.org/v2/${endpoint}?${query}`, {
    cache: "no-store",
  });
  const data = await res.json();
  if (data.status !== "ok") throw new Error(data.message ?? "NewsAPI error");
  return data.articles as NewsApiArticle[];
}

function dedupeByUrl(articles: NewsApiArticle[]): NewsApiArticle[] {
  const seen = new Set<string>();
  return articles.filter((a) => {
    if (seen.has(a.url)) return false;
    seen.add(a.url);
    return true;
  });
}

export async function GET(request: Request) {
  const apiKey = process.env.NEWS_API_KEY;
  if (!apiKey || apiKey === "your_newsapi_key_here") {
    return Response.json(
      { error: "NEWS_API_KEY is not configured in .env.local" },
      { status: 500 }
    );
  }

  let newsApiArticles: NewsApiArticle[];
  try {
    const popularMode = new URL(request.url).searchParams.get("mode") === "popular";

    // Korea-related articles always remain the primary topic. Popular mode uses
    // NewsAPI's publisher popularity ranking after repeated duplicate refreshes.
    const koreaArticles = popularMode
      ? await fetchNewsApiArticles(apiKey, "everything", {
          q: "Korea OR Korean OR Seoul",
          language: "en",
          sortBy: "popularity",
          pageSize: "10",
        })
      : await fetchNewsApiArticles(apiKey, "top-headlines", {
          q: "Korea",
          pageSize: "10",
        });

    // Fill any remaining slots with general top headlines.
    const needed = 10 - koreaArticles.length;
    const generalArticles =
      needed > 0
        ? await fetchNewsApiArticles(apiKey, "top-headlines", {
            country: "us",
            category: "general",
            pageSize: String(needed + 5),
          })
        : [];

    newsApiArticles = dedupeByUrl([...koreaArticles, ...generalArticles]).slice(0, 10);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch news";
    return Response.json({ error: message }, { status: 502 });
  }

  const articles: Article[] = await Promise.all(
    newsApiArticles.map(async (a) => {
      const id = createHash("md5").update(a.url).digest("hex");
      const content = await extractContent(a.url, a.description ?? "");
      return {
        id,
        title: a.title,
        content,
        url: a.url,
        publishedAt: a.publishedAt,
        source: a.source.name,
      };
    })
  );

  return Response.json({
    articles,
    mode: new URL(request.url).searchParams.get("mode") === "popular" ? "popular" : "korea",
  });
}
