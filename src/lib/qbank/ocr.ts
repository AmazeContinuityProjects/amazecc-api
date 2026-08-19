import { getDbPool } from "@/lib/db";
import { fetchPaperPdfBuffer, type QBankPaper } from "./utils";
import { PDFParse } from "pdf-parse";

/**
 * Real OCR pipeline for question papers.
 *
 * Engine chain:
 *  1. text-layer  — pdf-parse v2 (pdfjs text extraction): instant, exact for digital PDFs
 *  2. tesseract   — pdf-parse page screenshots + tesseract.js for scanned papers
 *
 * The extracted text is segmented into questions (number, text, marks, type,
 * MCQ options) and written to qbank_questions. The paper moves to
 * PENDING_Q_APPROVAL for admin review, or OCR_FAILED with logs on error.
 */

type OcrEngine = 'text-layer' | 'tesseract';

export interface ExtractedQuestion {
  question_number: string;
  question_text: string;
  marks: number;
  question_type: 'MCQ' | 'DESCRIPTIVE' | 'NUMERICAL';
  options: Record<string, string> | null;
  correct_answer: string | null;
}

export interface OcrResult {
  success: boolean;
  count?: number;
  engine?: OcrEngine;
  pages?: number;
  elapsedMs?: number;
  error?: string;
}

type ProgressFn = (progress: number, message: string) => Promise<void> | void;

// ─────────────────────────────────────────────────────────────
// PDF → text extraction
// ─────────────────────────────────────────────────────────────

async function extractTextLayer(buffer: Buffer): Promise<string[]> {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result.pages
      .map((p) => p.text.trim())
      .filter((t) => t.length > 0);
  } finally {
    await parser.destroy().catch(() => {});
  }
}

async function rasterizeAndOcr(
  buffer: Buffer,
  onProgress: ProgressFn
): Promise<string[]> {
  const { createWorker } = await import("tesseract.js");

  const parser = new PDFParse({ data: buffer });
  let worker: Awaited<ReturnType<typeof createWorker>> | null = null;
  try {
    let lastLog = 0;
    worker = await createWorker("eng", 1, {
      logger: (m: { status?: string; progress?: number }) => {
        if (m.status === "recognizing text" && typeof m.progress === "number") {
          const now = Date.now();
          if (now - lastLog > 2500) {
            lastLog = now;
            const pct = 10 + Math.round(m.progress * 70);
            void onProgress(pct, `Recognizing text… ${pct}%`);
          }
        }
      },
    });

    const screenshots = await parser.getScreenshot({ scale: 200 / 72, imageBuffer: true });
    const pages: string[] = [];
    for (const shot of screenshots.pages) {
      const image = shot.data
        ? Buffer.from(shot.data)
        : Buffer.from(shot.dataUrl.replace(/^data:[^;]+;base64,/, ""), "base64");
      const { data } = await worker.recognize(image);
      pages.push((data.text || "").trim());
      void onProgress(15 + Math.round((shot.pageNumber / screenshots.total) * 70), `Page ${shot.pageNumber}/${screenshots.total} done`);
    }
    return pages.filter((p) => p.length > 0);
  } finally {
    if (worker) await worker.terminate().catch(() => {});
    await parser.destroy().catch(() => {});
  }
}

async function extractPdfText(
  buffer: Buffer,
  onProgress: ProgressFn
): Promise<{ pages: string[]; engine: OcrEngine }> {
  // Fast path: embedded text layer (digital PDFs)
  try {
    const pages = await extractTextLayer(buffer);
    const usable = pages.reduce((n, p) => n + p.length, 0);
    if (pages.length > 0 && usable > pages.length * 30) {
      return { pages, engine: "text-layer" };
    }
  } catch {
    /* fall through to tesseract */
  }
  return { pages: await rasterizeAndOcr(buffer, onProgress), engine: "tesseract" };
}

// ─────────────────────────────────────────────────────────────
// Text → structured questions (segmentation)
// ─────────────────────────────────────────────────────────────

const QUESTION_START = /^(?:Q\.?\s*)?(\d{1,3})\s*[\.\):]\s*(?:\([ivxIVX\d]+\)\s*)?/;
const OPTION_LINE = /^([A-Da-d])[\.\)]\s+(.+)$/;
const MARKS_RE =
  /(?:\((\d+(?:\.\d+)?)\s*(?:mark|marks?)?\s*\)|(?:^|\s)(\d+(?:\.\d+)?)\s*(?:mark|marks?)\b)/i;
const NUMERICAL_RE =
  /[=≈≤≥]|(?:cm|mm|kg|m\/s|km|V|A|W|Ω|ohm|Hz|N|J|rad|mols?|ml|l)\b|%|(?:×|x|\*)\s*\d|\d\s*(?:×|x|\*)\s*\d/;
const HEADER_NOISE =
  /^(?:vit|vitchennai|chennai|reg\.?\s*no|registration|seat|hall|section|semester|part [ab]|total|answer|instructions?|time|max\.?\s*marks|attempt|question paper|subject|course|code|branch|school)/i;

interface Block {
  number: string;
  lines: string[];
}

export function segmentQuestions(pages: string[]): ExtractedQuestion[] {
  const blocks: Block[] = [];
  let current: Block | null = null;

  for (const page of pages) {
    for (const rawLine of page.split("\n")) {
      const line = rawLine.trim();
      if (!line) continue;
      if (HEADER_NOISE.test(line) && line.length < 60) continue;

      const match = line.match(QUESTION_START);
      if (match) {
        const rest = line.slice(match[0].length).trim();
        if (/^or$/i.test(rest)) continue;
        const num = match[1];
        if (!current || current.number !== num) {
          current = { number: num, lines: [] };
          blocks.push(current);
        }
        current.lines.push(line);
      } else if (current) {
        current.lines.push(line);
      }
    }
  }

  const questions: ExtractedQuestion[] = [];
  for (const block of blocks) {
    const text = block.lines.join("\n").trim();
    if (!text) continue;

    // Marks: prefer a trailing "(n Marks)" or a short bare "(n)" annotation on
    // the last line; a bare "(n)" needs n >= 2 to avoid matching math like "O(1)"
    const lastLine = block.lines[block.lines.length - 1];
    let trailing: RegExpMatchArray | null = lastLine.match(
      /(?:\((\d+(?:\.\d+)?)\s*marks?\)|\b(\d+(?:\.\d+)?)\s*marks?)\s*$/i
    );
    if (!trailing && lastLine.length < 60) {
      const bare = lastLine.match(/\((\d+(?:\.\d+)?)\)\s*$/);
      if (bare && parseFloat(bare[1]) >= 2) trailing = bare;
    }
    const anyWhere = text.match(MARKS_RE);
    const marks = parseFloat(
      (trailing?.[1] || trailing?.[2] || anyWhere?.[1] || anyWhere?.[2]) ?? "0"
    );

    // MCQ options: at least 3 consecutive A–D option lines
    const optionLines: Array<{ key: string; value: string }> = [];
    for (const line of block.lines) {
      const om = line.match(OPTION_LINE);
      if (om) {
        optionLines.push({ key: om[1].toUpperCase(), value: om[2].trim() });
      }
    }
    const letters = optionLines.map((o) => o.key);
    const hasMcq = ["A", "B", "C", "D"].every((l) => letters.includes(l));

    let question_type: ExtractedQuestion["question_type"] = "DESCRIPTIVE";
    let options: Record<string, string> | null = null;
    if (hasMcq) {
      question_type = "MCQ";
      options = Object.fromEntries(optionLines.map((o) => [o.key, o.value]));
    } else if (NUMERICAL_RE.test(text)) {
      question_type = "NUMERICAL";
    }

    // Strip the marks annotation from the stored text
    const cleanText = text
      .replace(/\s*\(\d+(?:\.\d+)?\s*(?:marks?)?\)\s*$/i, "")
      .trim();

    questions.push({
      question_number: block.number,
      question_text: cleanText,
      marks: isNaN(marks) ? 0 : marks,
      question_type,
      options,
      correct_answer: null,
    });
  }

  return questions;
}

// ─────────────────────────────────────────────────────────────
// Orchestrator
// ─────────────────────────────────────────────────────────────

export async function runPaperOcr(
  paperId: string,
  requestedModel?: string
): Promise<OcrResult> {
  const pool = getDbPool();
  const started = Date.now();

  const setStatus = async (progress: number, message: string, model?: string) => {
    const updates = ["ocr_progress = $2", "ocr_logs = $3"];
    const values: Array<string | number> = [paperId, progress, message];
    if (model) {
      updates.push("ocr_model = $4");
      values.push(model);
    }
    await pool.query(
      `UPDATE papers_archive SET ${updates.join(", ")} WHERE source_id = $1`,
      values
    );
  };

  try {
    const { rows } = await pool.query(
      `SELECT * FROM papers_archive WHERE source_id = $1`,
      [paperId]
    );
    if (rows.length === 0) {
      return { success: false, error: "Paper not found" };
    }
    const paper = rows[0] as QBankPaper;

    await pool.query(
      `UPDATE papers_archive SET approval_status = 'OCR_PROCESSING' WHERE source_id = $1`,
      [paperId]
    );
    await setStatus(2, "Starting OCR pipeline…", requestedModel || "mixed");

    const buffer = await fetchPaperPdfBuffer(paper);
    if (buffer.length === 0) throw new Error("Downloaded PDF is empty");

    await setStatus(
      8,
      `Downloaded ${(buffer.length / (1024 * 1024)).toFixed(2)} MB — extracting text…`
    );

    const { pages, engine } = await extractPdfText(buffer, (progress, message) =>
      setStatus(progress, message)
    );

    if (pages.length === 0) {
      throw new Error(`No readable content extracted (engine: ${engine})`);
    }

    await setStatus(
      80,
      `${engine} extracted ${pages.length} page${pages.length > 1 ? "s" : ""} — segmenting questions…`
    );

    const questions = segmentQuestions(pages);
    if (questions.length === 0) {
      throw new Error("No questions could be segmented from the extracted text");
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("DELETE FROM qbank_questions WHERE source_id = $1", [paperId]);
      for (const q of questions) {
        await client.query(
          `INSERT INTO qbank_questions
             (source_id, question_number, question_text, marks, question_type, options, correct_answer)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            paperId,
            q.question_number,
            q.question_text,
            q.marks,
            q.question_type,
            q.options ? JSON.stringify(q.options) : null,
            q.correct_answer,
          ]
        );
      }
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }

    const elapsedMs = Date.now() - started;
    const logSummary = [
      `engine: ${engine}`,
      `pages: ${pages.length}`,
      `questions: ${questions.length}`,
      `elapsed: ${(elapsedMs / 1000).toFixed(1)}s`,
      `mcq: ${questions.filter((q) => q.question_type === "MCQ").length}`,
      `numerical: ${questions.filter((q) => q.question_type === "NUMERICAL").length}`,
      `descriptive: ${questions.filter((q) => q.question_type === "DESCRIPTIVE").length}`,
    ].join("\n");

    await pool.query(
      `UPDATE papers_archive
       SET approval_status = 'PENDING_Q_APPROVAL', ocr_progress = 100, ocr_model = $2, ocr_logs = $3
       WHERE source_id = $1`,
      [paperId, engine, logSummary]
    );

    return {
      success: true,
      count: questions.length,
      engine,
      pages: pages.length,
      elapsedMs,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown OCR error";
    await pool
      .query(
        `UPDATE papers_archive
         SET approval_status = 'OCR_FAILED', ocr_logs = $2
         WHERE source_id = $1`,
        [paperId, `ERROR: ${message}`]
      )
      .catch(() => {});
    return { success: false, error: message };
  }
}