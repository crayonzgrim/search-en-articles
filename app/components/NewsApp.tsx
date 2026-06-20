"use client";

import { useEffect, useState } from "react";
import type { Article } from "@/app/api/news/route";
import ArticleList from "./ArticleList";
import ArticleModal from "./ArticleModal";

const ARTICLES_STORAGE_KEY = "daily-english:articles:v1";
const SAVED_ARTICLES_STORAGE_KEY = "daily-english:saved-articles:v1";
const REFRESH_STATE_STORAGE_KEY = "daily-english:refresh-state:v1";
const DUPLICATE_REFRESH_LIMIT = 3;

type RefreshState = {
  date: string;
  duplicateRefreshes: number;
  popularMode: boolean;
};

function todayKey() {
  return new Date().toLocaleDateString("en-CA");
}

function readRefreshState(): RefreshState {
  const initialState: RefreshState = {
    date: todayKey(),
    duplicateRefreshes: 0,
    popularMode: false,
  };

  try {
    const cached = localStorage.getItem(REFRESH_STATE_STORAGE_KEY);
    if (!cached) return initialState;

    const parsed = JSON.parse(cached) as Partial<RefreshState>;
    if (parsed.date !== initialState.date) return initialState;

    return {
      date: initialState.date,
      duplicateRefreshes:
        typeof parsed.duplicateRefreshes === "number" ? parsed.duplicateRefreshes : 0,
      popularMode: parsed.popularMode === true,
    };
  } catch {
    return initialState;
  }
}

function cacheRefreshState(state: RefreshState) {
  try {
    localStorage.setItem(REFRESH_STATE_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Continue without persistence when storage is unavailable.
  }
}

function normalizeTitle(title: string) {
  return title.toLocaleLowerCase().replace(/\s+/g, " ").trim();
}

function containsDuplicateTitle(current: Article[], next: Article[]) {
  const currentTitles = new Set(current.map((article) => normalizeTitle(article.title)));
  return next.some((article) => currentTitles.has(normalizeTitle(article.title)));
}

function readCachedArticles(storageKey: string): Article[] | null {
  try {
    const cached = localStorage.getItem(storageKey);
    if (!cached) return null;

    const parsed: unknown = JSON.parse(cached);
    if (!Array.isArray(parsed) || parsed.length === 0) return null;

    const articles = parsed.filter(
      (item): item is Article =>
        typeof item === "object" &&
        item !== null &&
        typeof item.id === "string" &&
        typeof item.title === "string" &&
        typeof item.content === "string" &&
        typeof item.url === "string" &&
        typeof item.publishedAt === "string" &&
        typeof item.source === "string"
    );

    return articles.length > 0 ? articles : null;
  } catch {
    return null;
  }
}

function cacheArticles(storageKey: string, articles: Article[]) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(articles));
  } catch {
    // Continue without persistence when storage is unavailable or full.
  }
}

export default function NewsApp() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [savedArticles, setSavedArticles] = useState<Article[]>([]);
  const [activeTab, setActiveTab] = useState<"latest" | "saved">("latest");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Article | null>(null);

  useEffect(() => {
    setSavedArticles(readCachedArticles(SAVED_ARTICLES_STORAGE_KEY) ?? []);

    const cached = readCachedArticles(ARTICLES_STORAGE_KEY);
    if (cached) {
      setArticles(cached);
      setSelected(cached[0]);
      setLoading(false);
      return;
    }

    void loadArticles(false);
    // Cache hydration and the cache-miss request must only run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchArticles(popularMode: boolean) {
    const res = await fetch(popularMode ? "/api/news?mode=popular" : "/api/news");
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error ?? "Failed to fetch news");
    return data.articles as Article[];
  }

  async function loadArticles(isManualRefresh = true) {
    setLoading(true);
    setError(null);

    try {
      const refreshState = readRefreshState();
      let nextArticles = await fetchArticles(isManualRefresh && refreshState.popularMode);

      if (isManualRefresh && !refreshState.popularMode) {
        const duplicateRefreshes = containsDuplicateTitle(articles, nextArticles)
          ? refreshState.duplicateRefreshes + 1
          : 0;

        if (duplicateRefreshes >= DUPLICATE_REFRESH_LIMIT) {
          nextArticles = await fetchArticles(true);
          cacheRefreshState({
            date: todayKey(),
            duplicateRefreshes,
            popularMode: true,
          });
        } else {
          cacheRefreshState({
            date: todayKey(),
            duplicateRefreshes,
            popularMode: false,
          });
        }
      }

      setArticles(nextArticles);
      setSelected(nextArticles[0] ?? null);
      setActiveTab("latest");
      cacheArticles(ARTICLES_STORAGE_KEY, nextArticles);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch news");
    } finally {
      setLoading(false);
    }
  }

  function selectTab(tab: "latest" | "saved") {
    setActiveTab(tab);
    const nextList = tab === "latest" ? articles : savedArticles;
    setSelected((current) => {
      if (current && nextList.some((article) => article.id === current.id)) return current;
      return nextList[0] ?? null;
    });
  }

  function toggleSavedArticle(article: Article) {
    setSavedArticles((current) => {
      const isAlreadySaved = current.some((saved) => saved.id === article.id);
      const next = isAlreadySaved
        ? current.filter((saved) => saved.id !== article.id)
        : [article, ...current];

      cacheArticles(SAVED_ARTICLES_STORAGE_KEY, next);

      if (isAlreadySaved && activeTab === "saved") {
        setSelected(next[0] ?? null);
      }

      return next;
    });
  }

  const visibleArticles = activeTab === "latest" ? articles : savedArticles;
  const selectedIsSaved = selected
    ? savedArticles.some((article) => article.id === selected.id)
    : false;

  return (
    <main className="min-h-screen bg-stone-100 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100 lg:grid lg:h-screen lg:grid-cols-[20%_80%] lg:overflow-hidden">
      <aside className="border-b border-stone-300 bg-[#f7f3e9] dark:border-zinc-800 dark:bg-zinc-900 lg:flex lg:min-h-0 lg:flex-col lg:border-r lg:border-b-0">
        <header className="flex items-center justify-between gap-3 border-b border-stone-300 px-4 py-4 dark:border-zinc-800">
          <div className="min-w-0">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-700 dark:text-amber-500">
              Reading desk
            </p>
            <h1 className="mt-1 font-serif text-xl font-bold tracking-tight">Daily English</h1>
          </div>
          <button
            type="button"
            onClick={() => void loadArticles(true)}
            disabled={loading}
            className="inline-flex shrink-0 items-center gap-1.5 border border-zinc-900 bg-zinc-900 px-2.5 py-2 text-xs font-semibold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-amber-400"
            aria-label="새로운 기사 불러오기"
          >
            <svg
              aria-hidden="true"
              className={loading ? "animate-spin" : ""}
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20 11a8.1 8.1 0 0 0-15.5-2M4 4v5h5" />
              <path d="M4 13a8.1 8.1 0 0 0 15.5 2M20 20v-5h-5" />
            </svg>
            새로고침
          </button>
        </header>

        <nav className="grid grid-cols-2 border-b border-stone-300 dark:border-zinc-800" aria-label="기사 목록">
          <button
            type="button"
            onClick={() => selectTab("latest")}
            aria-pressed={activeTab === "latest"}
            className={`border-r border-stone-300 px-3 py-3 font-mono text-[10px] font-bold uppercase tracking-[0.12em] transition dark:border-zinc-800 ${
              activeTab === "latest"
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950"
                : "text-zinc-500 hover:bg-white/60 dark:hover:bg-zinc-800"
            }`}
          >
            새 기사 <span className="ml-1 opacity-60">{articles.length}</span>
          </button>
          <button
            type="button"
            onClick={() => selectTab("saved")}
            aria-pressed={activeTab === "saved"}
            className={`px-3 py-3 font-mono text-[10px] font-bold uppercase tracking-[0.12em] transition ${
              activeTab === "saved"
                ? "bg-amber-700 text-white dark:bg-amber-500 dark:text-zinc-950"
                : "text-zinc-500 hover:bg-white/60 dark:hover:bg-zinc-800"
            }`}
          >
            저장한 기사 <span className="ml-1 opacity-70">{savedArticles.length}</span>
          </button>
        </nav>

        <div className="min-h-0 lg:flex-1 lg:overflow-y-auto">
          {loading && activeTab === "latest" ? (
            <ul className="divide-y divide-stone-300 dark:divide-zinc-800">
              {Array.from({ length: 10 }).map((_, i) => (
                <li key={i} className="space-y-2 px-4 py-5">
                  <div className="h-3 w-full animate-pulse bg-stone-300 dark:bg-zinc-700" />
                  <div className="h-2.5 w-2/3 animate-pulse bg-stone-200 dark:bg-zinc-800" />
                </li>
              ))}
            </ul>
          ) : null}

          {!loading && error ? (
            <div className="m-4 border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
              {error}
            </div>
          ) : null}

          {(!loading || activeTab === "saved") && visibleArticles.length > 0 ? (
            <ArticleList
              articles={visibleArticles}
              selectedId={selected?.id ?? null}
              onSelect={setSelected}
            />
          ) : null}

          {activeTab === "saved" && savedArticles.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <svg
                aria-hidden="true"
                className="mx-auto text-stone-400 dark:text-zinc-600"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="M6 3h12v18l-6-4-6 4V3Z" />
              </svg>
              <p className="mt-3 font-serif text-sm text-zinc-500">
                저장한 기사가 없습니다.
              </p>
            </div>
          ) : null}
        </div>
      </aside>

      <section className="min-w-0 bg-white dark:bg-zinc-950 lg:min-h-0 lg:overflow-hidden">
        {selected ? (
          <ArticleModal
            key={selected.id}
            article={selected}
            isSaved={selectedIsSaved}
            onToggleSave={toggleSavedArticle}
          />
        ) : (
          <div className="flex min-h-[50vh] items-center justify-center px-8 text-center lg:h-full">
            <div>
              <p className="font-serif text-3xl text-zinc-300 dark:text-zinc-700">Aa</p>
              <p className="mt-3 text-sm text-zinc-500">왼쪽에서 읽을 기사를 선택하세요.</p>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
