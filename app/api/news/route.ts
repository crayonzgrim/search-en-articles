import { extract } from "@extractus/article-extractor";
import { createHash } from "crypto";

// Vercel kills the function at the plan default (10s on Hobby) otherwise, which
// shows up as an endlessly pending request when article extraction is slow.
export const maxDuration = 60;

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

type WorldNewsArticle = {
  title: string;
  text: string | null;
  summary: string | null;
  url: string;
  publish_date: string;
  source_country: string | null;
};

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

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
    // extract() has no built-in timeout; a single slow source would otherwise
    // stall the whole Promise.all and blow the function budget.
    const result = await Promise.race([
      extract(url),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 6000)),
    ]);
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

// World News API returns the full article body in `text`, so these need no
// crawling step — unlike NewsAPI, which only gives a description.
async function fetchWorldNewsKorea(apiKey: string, popularMode: boolean): Promise<Article[]> {
  // Korean publishers rarely tag English, so source-countries=kr returns 0 for
  // language=en. text=Korea finds English articles about Korea instead.
  // ponytail: loose relevance (any "Korea" mention); tighten with sort=relevance
  // or text="South Korea" OR Seoul if too many tangential hits.
  const query = new URLSearchParams({
    text: "Korea",
    language: "en",
    number: "10",
    sort: "publish-time",
    "sort-direction": "DESC",
    ...(popularMode ? { offset: "10" } : {}),
  });
  const res = await fetch(`https://api.worldnewsapi.com/search-news?${query}`, {
    headers: { "x-api-key": apiKey },
    cache: "no-store",
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message ?? "World News API error");

  return ((data.news ?? []) as WorldNewsArticle[]).map((n) => ({
    id: createHash("md5").update(n.url).digest("hex"),
    title: n.title,
    content: n.text?.trim() || n.summary?.trim() || "",
    url: n.url,
    publishedAt: n.publish_date,
    source: hostnameOf(n.url) || n.source_country || "World News API",
  }));
}

function dedupeByUrl<T extends { url: string }>(articles: T[]): T[] {
  const seen = new Set<string>();
  return articles.filter((a) => {
    if (seen.has(a.url)) return false;
    seen.add(a.url);
    return true;
  });
}

// Batch 2: general top headlines from NewsAPI (max 10). These have no body, so
// each is crawled with extractContent (bounded by the per-call timeout above).
async function fetchNewsApiBatch(apiKey: string, popularMode: boolean): Promise<Article[]> {
  const headlines = await fetchNewsApiArticles(apiKey, "top-headlines", {
    country: "us",
    category: "general",
    pageSize: "10",
    ...(popularMode ? { page: "2" } : {}),
  });

  return Promise.all(
    dedupeByUrl(headlines)
      .slice(0, 10)
      .map(async (a) => ({
        id: createHash("md5").update(a.url).digest("hex"),
        title: a.title,
        content: await extractContent(a.url, a.description ?? ""),
        url: a.url,
        publishedAt: a.publishedAt,
        source: a.source.name,
      }))
  );
}

export async function GET(request: Request) {
  const worldKey = process.env.WORLD_NEWS_API_KEY;
  const newsApiKey = process.env.NEWS_API_KEY;
  const popularMode = new URL(request.url).searchParams.get("mode") === "popular";

  // Run both sources independently so one failing key/quota still returns the
  // other source's articles instead of an empty page.
  const [koreaResult, generalResult] = await Promise.allSettled([
    worldKey && worldKey !== "your_worldnewsapi_key_here"
      ? fetchWorldNewsKorea(worldKey, popularMode)
      : Promise.reject(new Error("WORLD_NEWS_API_KEY is not configured")),
    newsApiKey && newsApiKey !== "your_newsapi_key_here"
      ? fetchNewsApiBatch(newsApiKey, popularMode)
      : Promise.reject(new Error("NEWS_API_KEY is not configured")),
  ]);

  const koreaArticles = koreaResult.status === "fulfilled" ? koreaResult.value : [];
  const generalArticles = generalResult.status === "fulfilled" ? generalResult.value : [];

  if (koreaArticles.length === 0 && generalArticles.length === 0) {
    const reason =
      koreaResult.status === "rejected" ? koreaResult.reason?.message : undefined;
    return Response.json(
      { error: reason ?? "Failed to fetch news from both sources" },
      { status: 502 }
    );
  }

  // Korea articles (World News API) first, then general (NewsAPI), max 20.
  const articles = dedupeByUrl([...koreaArticles, ...generalArticles]).slice(0, 20);

  return Response.json({ articles, mode: popularMode ? "popular" : "korea" });
}
