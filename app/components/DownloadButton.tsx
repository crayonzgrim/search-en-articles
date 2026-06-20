"use client";

import type { Article } from "@/app/api/news/route";

type Props = {
  article: Article;
  questions: string[];
};

export default function DownloadButton({ article, questions }: Props) {
  function handleDownload() {
    const lines: string[] = [
      article.title,
      "=".repeat(article.title.length),
      "",
      article.content,
    ];

    if (questions.length > 0) {
      lines.push("", "---", "", "Comprehension Questions", "-".repeat(22), "");
      questions.forEach((q, i) => {
        lines.push(`${i + 1}. ${q}`);
      });
    }

    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${article.title.slice(0, 50).replace(/[^a-z0-9]/gi, "_")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      onClick={handleDownload}
      className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
      Download TXT
    </button>
  );
}
