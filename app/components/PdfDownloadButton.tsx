"use client";

import type { Article } from "@/app/api/news/route";
import jsPDF from "jspdf";

type Props = {
  article: Article;
  questions: string[];
};

export default function PdfDownloadButton({ article, questions }: Props) {
  function handleDownload() {
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const maxWidth = pageWidth - margin * 2;
    let y = margin;

    function checkPageBreak(needed: number) {
      if (y + needed > pageHeight - margin) {
        doc.addPage();
        y = margin;
      }
    }

    // Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    const titleLines = doc.splitTextToSize(article.title, maxWidth);
    checkPageBreak(titleLines.length * 7);
    doc.text(titleLines, margin, y);
    y += titleLines.length * 7 + 2;

    // Source
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text(article.source, margin, y);
    y += 8;
    doc.setTextColor(0);

    // Divider
    doc.setDrawColor(200);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;

    // Content
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    const paragraphs = (article.content || "").split("\n").filter(Boolean);
    for (const para of paragraphs) {
      const lines = doc.splitTextToSize(para, maxWidth);
      checkPageBreak(lines.length * 5.5);
      doc.text(lines, margin, y);
      y += lines.length * 5.5 + 4;
    }

    // Questions section
    if (questions.length > 0) {
      checkPageBreak(20);
      y += 4;
      doc.setDrawColor(200);
      doc.line(margin, y, pageWidth - margin, y);
      y += 10;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text("Discussion Questions", margin, y);
      y += 10;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      for (let i = 0; i < questions.length; i++) {
        const qText = `${i + 1}. ${questions[i]}`;
        const qLines = doc.splitTextToSize(qText, maxWidth);
        checkPageBreak(qLines.length * 5.5 + 3);
        doc.text(qLines, margin, y);
        y += qLines.length * 5.5 + 3;
      }
    }

    const filename = `${article.title.slice(0, 50).replace(/[^a-z0-9]/gi, "_")}.pdf`;
    doc.save(filename);
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
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </svg>
      Download PDF
    </button>
  );
}
