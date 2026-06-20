"use client";

import { useState } from "react";

type Props = {
  articleText: string;
  onQuestionsLoaded?: (questions: string[], checkedStates?: boolean[]) => void;
};

export default function QuestionPanel({ articleText, onQuestionsLoaded }: Props) {
  const [questions, setQuestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkedQuestions, setCheckedQuestions] = useState<boolean[]>([]);

  async function generateQuestions() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleText }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error ?? "Failed to generate questions");
      }

      const nextQuestions = data.questions as string[];
      const initialChecked = new Array(nextQuestions.length).fill(true);
      setQuestions(nextQuestions);
      setCheckedQuestions(initialChecked);
      onQuestionsLoaded?.(nextQuestions, initialChecked);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate questions");
    } finally {
      setLoading(false);
    }
  }

  if (!loading && questions.length === 0) {
    return (
      <div className="border border-dashed border-zinc-300 bg-zinc-50 p-5 text-center dark:border-zinc-700 dark:bg-zinc-900/50">
        <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          필요할 때만 AI로 독해 질문 30개를 만드세요.
        </p>
        <button
          type="button"
          onClick={() => void generateQuestions()}
          className="mt-4 inline-flex items-center gap-2 bg-amber-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 dark:bg-amber-500 dark:text-zinc-950 dark:hover:bg-amber-400"
        >
          <svg
            aria-hidden="true"
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m12 3-1.7 4.3L6 9l4.3 1.7L12 15l1.7-4.3L18 9l-4.3-1.7L12 3Z" />
            <path d="m5 16-.9 2.1L2 19l2.1.9L5 22l.9-2.1L8 19l-2.1-.9L5 16Z" />
          </svg>
          AI 질문 만들기
        </button>
        {error ? (
          <p className="mt-3 text-xs text-red-600 dark:text-red-400">{error}</p>
        ) : null}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-3 pt-2">
        {Array.from({ length: 30 }).map((_, i) => (
          <div key={i} className="flex gap-2">
            <input
              type="checkbox"
              disabled
              className="mt-0.5 shrink-0 cursor-not-allowed rounded border-zinc-300 text-blue-600 opacity-50"
            />
            <span className="shrink-0 text-xs font-semibold text-zinc-400">{i + 1}.</span>
            <div className="h-4 w-full animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
        {error}
      </p>
    );
  }

  const handleCheckboxChange = (index: number) => {
    const newCheckedStates = [...checkedQuestions];
    newCheckedStates[index] = !newCheckedStates[index];
    setCheckedQuestions(newCheckedStates);
    onQuestionsLoaded?.(questions, newCheckedStates);
  };

  return (
    <ol className="flex flex-col gap-3">
      {questions.map((q, i) => (
        <li key={i} className="flex gap-2">
          <input
            type="checkbox"
            checked={checkedQuestions[i] ?? false}
            onChange={() => handleCheckboxChange(i)}
            className="mt-0.5 shrink-0 cursor-pointer rounded border-zinc-300 text-blue-600"
          />
          <span className="shrink-0 text-xs font-bold text-blue-500">{i + 1}.</span>
          <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">{q}</p>
        </li>
      ))}
    </ol>
  );
}
