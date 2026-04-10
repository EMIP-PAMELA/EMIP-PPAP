/**
 * Harness Work Instruction Generator — PDF Service
 * Phase HWI.4 — PDF Generation
 *
 * Renders a validated HarnessInstructionJob to a PDF buffer via Puppeteer.
 * Uses dynamic import to avoid bundler analysis of the Puppeteer Node module.
 *
 * Steps:
 *   1. Build HTML via renderWorkInstructionHTML()
 *   2. Launch headless Chromium via Puppeteer
 *   3. Set page content and wait for layout
 *   4. Print to PDF (Letter format, print background)
 *   5. Close browser, return Buffer
 */

import type { HarnessInstructionJob } from '../types/harnessInstruction.schema';
import { renderWorkInstructionHTML } from '../templates/workInstructionTemplate';

export interface PDFResult {
  buffer: Buffer;
  filename: string;
  sizeBytes: number;
}

export async function generateInstructionPDF(job: HarnessInstructionJob): Promise<PDFResult> {
  console.log('[HWI PDF GENERATION START]', {
    partNumber: job.metadata.part_number,
    revision: job.metadata.revision,
    wires: job.wire_instances.length,
    flags: job.engineering_flags.length,
    timestamp: new Date().toISOString(),
  });

  const html = renderWorkInstructionHTML(job);

  console.log('[HWI TEMPLATE BUILT]', {
    htmlLength: html.length,
    partNumber: job.metadata.part_number,
  });

  const puppeteer = (await import('puppeteer')).default;

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  });

  try {
    const page = await browser.newPage();

    await page.setContent(html, { waitUntil: 'load' });

    const pdfBuffer = await page.pdf({
      format: 'Letter',
      printBackground: true,
      margin: {
        top:    '0.5in',
        right:  '0.5in',
        bottom: '0.65in',
        left:   '0.5in',
      },
      displayHeaderFooter: false,
    });

    const buffer = Buffer.from(pdfBuffer);
    const filename = `WI-${job.metadata.part_number}-Rev${job.metadata.revision}.pdf`
      .replace(/[^a-zA-Z0-9.\-_]/g, '_');

    console.log('[HWI PDF COMPLETE]', {
      filename,
      sizeBytes: buffer.length,
      partNumber: job.metadata.part_number,
    });

    return { buffer, filename, sizeBytes: buffer.length };
  } finally {
    await browser.close();
  }
}
