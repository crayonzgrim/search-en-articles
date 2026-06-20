"use client";

import jsPDF from "jspdf";

type Props = {
  title: string;
  questions: string[];
};

export default function QuestionsPdfDownloadButton({ title, questions }: Props) {
  function handleDownload() {
    if (questions.length === 0) {
      alert("Please select at least one question to download.");
      return;
    }

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
    const titleLines = doc.splitTextToSize(`${title} - Discussion Questions`, maxWidth);
    checkPageBreak(titleLines.length * 7);
    doc.text(titleLines, margin, y);
    y += titleLines.length * 7 + 10;

    // Questions
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    for (let i = 0; i < questions.length; i++) {
      const qText = `${i + 1}. ${questions[i]}`;
      const qLines = doc.splitTextToSize(qText, maxWidth);
      checkPageBreak(qLines.length * 5.5 + 3);
      doc.text(qLines, margin, y);
      y += qLines.length * 5.5 + 6;
    }

    const filename = `${title.slice(0, 50).replace(/[^a-z0-9]/gi, "_")}_questions.pdf`;
    doc.save(filename);
  }

  return (
    <button
      onClick={handleDownload}
      className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-700 transition-colors hover:bg-amber-100 dark:border-amber-900 dark:bg-amber-900/30 dark:text-amber-300 dark:hover:bg-amber-900/50"
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
      Discussion PDF
    </button>
  );
}
