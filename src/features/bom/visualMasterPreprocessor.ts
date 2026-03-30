/**
 * Visual Master Preprocessor
 * Phase W1.4 - Parser Stabilization Layer
 * 
 * Purpose: Lightweight, deterministic text-cleaning shim that prepares extracted
 * PDF text for the Visual Master Parser without changing parser logic.
 * 
 * This is NOT a parser.
 * This is NOT AI.
 * This is a stabilization layer only.
 * 
 * Responsibilities:
 * - Normalize line endings
 * - Normalize unicode dash variants
 * - Collapse repeated spaces safely
 * - Preserve structural elements (leading dashes, line boundaries)
 * - Avoid destructive transformations
 */

export interface PreprocessingSummary {
  originalLength: number;
  normalizedLength: number;
  originalLineCount: number;
  normalizedLineCount: number;
  dashNormalizations: number;
  blankLinesRemoved: number;
  tabsNormalized: number;
  trailingWhitespaceRemoved: number;
}

/**
 * Normalize Visual Master text for parser consumption
 * 
 * Safe normalization rules:
 * - em dash, en dash, minus variants → `-`
 * - tabs → single spaces
 * - repeated spaces (not affecting leading dash counts) → single space
 * - trim right side whitespace
 * - normalize line endings to \n
 * 
 * Preserves:
 * - Leading dashes (critical for parser structure detection)
 * - Line boundaries
 * - Numeric tokens
 * - Part IDs
 * 
 * @param text Raw extracted PDF text
 * @returns Normalized text ready for Visual Master Parser
 */
export function normalizeVisualMasterText(text: string): string {
  // Step 1: Normalize line endings to \n
  let normalized = text
    .replace(/\r\n/g, '\n')  // Windows line endings
    .replace(/\r/g, '\n');   // Old Mac line endings
  
  // Step 2: Normalize unicode dash variants to standard hyphen
  // Common variants from OCR/PDF extraction:
  // - U+2013 (en dash)
  // - U+2014 (em dash)
  // - U+2212 (minus sign)
  // - U+2010 (hyphen)
  normalized = normalized
    .replace(/[\u2013\u2014\u2212\u2010]/g, '-');
  
  // Step 3: Process line by line to preserve structure
  const lines = normalized.split('\n');
  const processedLines: string[] = [];
  
  for (const line of lines) {
    // Count leading dashes BEFORE any processing
    const leadingDashMatch = line.match(/^(\s*)(-+)/);
    const leadingWhitespace = leadingDashMatch ? leadingDashMatch[1] : '';
    const leadingDashes = leadingDashMatch ? leadingDashMatch[2] : '';
    
    // Get the rest of the line after leading dashes
    const restOfLine = leadingDashMatch 
      ? line.substring(leadingWhitespace.length + leadingDashes.length)
      : line;
    
    // Step 4: Normalize tabs to spaces in the rest of the line
    let processed = restOfLine.replace(/\t+/g, ' ');
    
    // Step 5: Collapse repeated spaces (but only in non-leading portion)
    // This preserves structure while cleaning OCR artifacts
    processed = processed.replace(/  +/g, ' ');
    
    // Step 6: Trim trailing whitespace
    processed = processed.trimEnd();
    
    // Reconstruct line: leading whitespace + leading dashes + processed rest
    const reconstructed = leadingWhitespace + leadingDashes + processed;
    
    // Only add non-empty lines or lines that have dashes
    // (preserve dash-only lines as they may be structural markers)
    if (reconstructed.trim() || leadingDashes) {
      processedLines.push(reconstructed);
    }
  }
  
  // Step 7: Join lines back together
  return processedLines.join('\n');
}

/**
 * Get preprocessing summary for debugging
 * 
 * @param original Original raw text
 * @param normalized Normalized text
 * @returns Summary object with before/after metrics
 */
export function getPreprocessingSummary(
  original: string,
  normalized: string
): PreprocessingSummary {
  // Count dash normalizations
  const dashVariants = /[\u2013\u2014\u2212\u2010]/g;
  const dashMatches = original.match(dashVariants);
  const dashNormalizations = dashMatches ? dashMatches.length : 0;
  
  // Count tabs
  const tabMatches = original.match(/\t/g);
  const tabsNormalized = tabMatches ? tabMatches.length : 0;
  
  // Count original and normalized lines
  const originalLines = original.split(/\r?\n/);
  const normalizedLines = normalized.split('\n');
  
  // Count blank lines removed
  const originalNonBlank = originalLines.filter(l => l.trim()).length;
  const normalizedNonBlank = normalizedLines.filter(l => l.trim()).length;
  const blankLinesRemoved = (originalLines.length - originalNonBlank) - (normalizedLines.length - normalizedNonBlank);
  
  // Count trailing whitespace removals (approximate)
  const trailingWhitespaceLines = originalLines.filter(l => l !== l.trimEnd()).length;
  
  return {
    originalLength: original.length,
    normalizedLength: normalized.length,
    originalLineCount: originalLines.length,
    normalizedLineCount: normalizedLines.length,
    dashNormalizations,
    blankLinesRemoved: Math.max(0, blankLinesRemoved),
    tabsNormalized,
    trailingWhitespaceRemoved: trailingWhitespaceLines
  };
}

/**
 * Get a preview of text (first N lines)
 * Utility for debug panels
 * 
 * @param text Text to preview
 * @param maxLines Maximum number of lines to include
 * @returns Preview string
 */
export function getTextPreview(text: string, maxLines: number = 150): string {
  const lines = text.split('\n');
  const preview = lines.slice(0, maxLines);
  const hasMore = lines.length > maxLines;
  
  return preview.join('\n') + (hasMore ? `\n\n... (${lines.length - maxLines} more lines)` : '');
}
