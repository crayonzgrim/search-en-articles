"use client";

import { useState } from "react";
import type { Article } from "@/app/api/news/route";
import QuestionPanel from "./QuestionPanel";
import DownloadButton from "./DownloadButton";
import PdfDownloadButton from "./PdfDownloadButton";
import QuestionsPdfDownloadButton from "./QuestionsPdfDownloadButton";

type Props = {
  article: Article;
  isSaved: boolean;
  onToggleSave: (article: Article) => void;
};

export default function ArticleModal({ article, isSaved, onToggleSave }: Props) {
  const [questions, setQuestions] = useState<string[]>([]);
  const [selectedQuestions, setSelectedQuestions] = useState<string[]>([]);

  return (
    <div className="h-full min-h-[60vh] bg-white dark:bg-zinc-950">
      <div className="relative flex h-full flex-col xl:flex-row">
        <div className="absolute inset-x-0 top-0 z-10 flex min-h-12 flex-wrap items-center justify-between gap-2 border-b border-zinc-200 bg-white/95 px-5 py-2 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-700 dark:text-amber-500">
              {article.source}
            </span>
            <button
              type="button"
              onClick={() => onToggleSave(article)}
              aria-pressed={isSaved}
              className={`inline-flex items-center gap-1.5 border px-3 py-1.5 text-sm font-semibold transition ${
                isSaved
                  ? "border-amber-700 bg-amber-700 text-white hover:bg-amber-800 dark:border-amber-500 dark:bg-amber-500 dark:text-zinc-950 dark:hover:bg-amber-400"
                  : "border-zinc-300 bg-white text-zinc-700 hover:border-amber-700 hover:text-amber-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
              }`}
            >
              <svg
                aria-hidden="true"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill={isSaved ? "currentColor" : "none"}
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M6 3h12v18l-6-4-6 4V3Z" />
              </svg>
              {isSaved ? "저장됨" : "기사 저장"}
            </button>
            <DownloadButton article={article} questions={questions} />
            <PdfDownloadButton article={article} questions={questions} />
            <QuestionsPdfDownloadButton
              title={article.title}
              questions={selectedQuestions}
            />
          </div>
          <a
            href={article.url}
            target="_blank"
            rel="noreferrer"
            className="font-mono text-[10px] font-semibold uppercase tracking-wider text-zinc-500 underline decoration-zinc-300 underline-offset-4 transition hover:text-amber-700"
          >
            원문 보기 ↗
          </a>
        </div>

        <article className="flex-1 overflow-y-auto px-6 pb-14 pt-20 sm:px-10 lg:px-14 xl:px-16">
          <h1 className="mb-8 max-w-4xl font-serif text-3xl font-bold leading-[1.12] tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-4xl">
            {article.title}
          </h1>
          <div className="max-w-3xl border-t border-zinc-900 pt-8 text-[15px] leading-8 dark:border-zinc-700">
            {article.content ? (
              article.content
                .split("\n")
                .filter(Boolean)
                .map((para, i) => (
                  <p key={i} className="mb-6 text-zinc-700 dark:text-zinc-300">
                    {para}
                  </p>
                ))
            ) : (
              <p className="text-zinc-400">No content available for this article.</p>
            )}
          </div>
        </article>

        <div className="hidden w-px bg-zinc-200 dark:bg-zinc-800 xl:mt-12 xl:block" />

        <aside className="w-full overflow-y-auto border-t border-zinc-200 px-6 pb-10 pt-20 dark:border-zinc-800 xl:w-[38rem] xl:shrink-0 xl:border-t-0 xl:px-9">
          <h2 className="mb-5 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
            Discussion Questions
          </h2>
          <QuestionPanel
            articleText={article.content}
            onQuestionsLoaded={(nextQuestions, checkedStates) => {
              setQuestions(nextQuestions);
              setSelectedQuestions(
                nextQuestions.filter((_, index) => checkedStates?.[index] ?? true)
              );
            }}
          />
        </aside>
      </div>
    </div>
  );
}
