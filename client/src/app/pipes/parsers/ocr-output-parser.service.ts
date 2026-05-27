import { Injectable } from '@angular/core';
import { OcrProvider } from '@open-receipt-ocr/types';
import { MistralOcrParser } from '@app/pipes/parsers/mistral-ocr.parser';
import { TabScannerOcrParser } from '@app/pipes/parsers/tabscanner-ocr.parser';
import { PaddleOcrApiParser } from '@app/pipes/parsers/paddle-ocr-api.parser';
import { PaddleOcrLocalParser } from '@app/pipes/parsers/paddle-ocr-local.parser';
import { GeminiParser } from '@app/pipes/parsers/gemini.parser';
import { AwsTextractParser } from '@app/pipes/parsers/aws-textract.parser';
import { GrokParser } from '@app/pipes/parsers/grok.parser';
import { TesseractParser } from '@app/pipes/parsers/tesseract.parser';
import { OpenAiParser } from '@app/pipes/parsers/openai.parser';
import { LlamaCppParser } from '@app/pipes/parsers/llama-cpp.parser';
import { RawJsonParser } from '@app/pipes/parsers/raw-json.parser';
import type { ParsedOcrOutput, OcrOutputParser } from '@app/pipes/parsers/ocr-output-parser.interface';

/**
 * Service to parse OCR output from different providers and extract markdown content.
 */
@Injectable({ providedIn: 'root' })
export class OcrOutputParserService {
  private readonly parsers: Record<OcrProvider, OcrOutputParser> = {
    [OcrProvider.Mistral]: new MistralOcrParser(),
    [OcrProvider.TabScanner]: new TabScannerOcrParser(),
    [OcrProvider.PaddleOcrApi]: new PaddleOcrApiParser(),
    [OcrProvider.PaddleOcrLocal]: new PaddleOcrLocalParser(),
    [OcrProvider.Gemini]: new GeminiParser(),
    [OcrProvider.AwsTextract]: new AwsTextractParser(),
    [OcrProvider.Grok]: new GrokParser(),
    [OcrProvider.Tesseract]: new TesseractParser(),
    [OcrProvider.OpenAi]: new OpenAiParser(),
    [OcrProvider.LlamaCpp]: new LlamaCppParser(),
    [OcrProvider.GeminiToWallet]: new RawJsonParser(),
  };

  private readonly fallbackParser = new RawJsonParser();

  /**
   * Parse a raw `ocrData` string (JSON) for the given provider and return
   * the extracted markdown.
   *
   * Returns `null` when `ocrData` is null/undefined/empty.
   */
  parse(ocrData: string | null | undefined, provider: OcrProvider): ParsedOcrOutput | null {
    if (!ocrData) return null;

    let parsed: unknown;
    try {
      parsed = JSON.parse(ocrData);
    } catch {
      // Not valid JSON — treat the raw string as markdown
      return { markdown: ocrData };
    }

    const parser = this.parsers[provider] ?? this.fallbackParser;
    return parser.parse(parsed);
  }
}
