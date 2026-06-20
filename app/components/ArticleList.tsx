"use client";

import type { Article } from "@/app/api/news/route";

type Props = {
  articles: Article[];
  selectedId: string | null;
  onSelect: (article: Article) => void;
};

export default function ArticleList({ articles, selectedId, onSelect }: Props) {
  return (
    <ul className="flex flex-col divide-y divide-stone-300 dark:divide-zinc-800">
      {articles.map((article, i) => (
        <li key={article.id}>
          <button
            type="button"
            onClick={() => onSelect(article)}
            aria-current={selectedId === article.id ? "true" : undefined}
            className={`group relative w-full px-4 py-5 text-left transition-colors before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-amber-600 before:transition-opacity hover:bg-white/70 dark:hover:bg-zinc-800/60 ${
              selectedId === article.id
                ? "bg-white before:opacity-100 dark:bg-zinc-800"
                : "before:opacity-0"
            }`}
          >
            <div className="flex items-start gap-3">
              <span className="mt-0.5 w-5 shrink-0 text-right font-mono text-[10px] font-bold tabular-nums text-amber-700/60 dark:text-amber-500/60">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="min-w-0 flex flex-col gap-1.5">
                <p className="font-serif text-[15px] font-semibold leading-snug text-zinc-900 group-hover:text-amber-800 dark:text-zinc-100 dark:group-hover:text-amber-400">
                  {article.title}
                </p>
                <p className="truncate font-mono text-[10px] uppercase tracking-wide text-zinc-500">
                  {article.source} &middot;{" "}
                  {new Date(article.publishedAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              </div>
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}
