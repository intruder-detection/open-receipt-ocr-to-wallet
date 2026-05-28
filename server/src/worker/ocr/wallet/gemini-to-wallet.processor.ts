import { Inject, Injectable, Logger } from '@nestjs/common';
import { GoogleGenAI } from '@google/genai';
import { extname } from 'path';
import { AppSecret } from '@core/types/app-secret.enum';
import { SecretProvider } from '@core/secrets/secret-provider.interface';
import { StorageProvider } from '@core/storage/storage-provider.interface';
import { FileExtension } from '@open-receipt-ocr/types';
import { OcrFileEntity } from '@core/database/entities/ocr-file.entity';
import { OcrExecutionEntity } from '@core/database/entities/ocr-execution.entity';
import { getMimeType } from '@worker/ocr/utils/mime-type.util';
import { streamToBase64 } from '@worker/ocr/utils/stream.util';
import { WalletService, WalletRecordPayload } from '@app/wallet/wallet.service';

function buildPrompt(categories: { id: string; name: string; groupName: string }[]): string {
  const categoryList = JSON.stringify(categories, null, 2);
  return `
You are an expert OCR and data extraction engine specialized in parsing Portuguese retail receipts.
Extract the following information from the provided receipt image and output the result strictly as a valid JSON object.
No markdown blocks, no code fences, just raw JSON.

Required fields in the JSON object:
- "extraction_scratchpad": A brief string where you explicitly state the raw text on the receipt that indicates the date and the total (e.g., "Found date in 'MOV:070924', total is 4.39").
- "amount": a number representing the total amount paid on the receipt.
- "recordDate": a string representing the date of the receipt in ISO 8601 format (e.g. "2024-09-07T12:00:00Z"). Look carefully for standard date formats (DD/MM/YYYY) as well as implicit dates hidden in Portuguese transaction codes (like "MOV:DDMMYY" at the bottom of the receipt). If time is unknown, default to 12:00:00Z.
- "note": a string containing a brief summary or transcription of the receipt items, STRICTLY capped at 255 characters. Add new line for formatting.
- "categoryId": the id of the best-matching category from the list below, based on the type of purchase on this receipt. If none fits well, use the id of the most generic one available.

Available categories (choose one id from this list):
${categoryList}

Example Output format:
{
  "extraction_scratchpad": "Date found in string 'MOV:070924' meaning Sept 7, 2024. Total pago is 4.39.",
  "amount": 12.34,
  "recordDate": "2025-03-15T12:00:00Z",
  "note": "Lunch at restaurant: 1x Burger, 1x Fries",
  "categoryId": "5c5c1f44-0050-8000-8000-000000000000"
}
`;
}

@Injectable()
export class GeminiToWalletProcessor {
  private readonly logger = new Logger(GeminiToWalletProcessor.name);

  constructor(
    @Inject(SecretProvider) private readonly secretProvider: SecretProvider,
    private readonly storage: StorageProvider,
    private readonly walletService: WalletService,
  ) {
  }

  async process(file: OcrFileEntity, executionId: number): Promise<string> {
    const apiKey = await this.secretProvider.getSecretOrThrow(AppSecret.GeminiApiKey);
    const geminiModel = await this.secretProvider.getSecretOrThrow(AppSecret.GeminiModel);
    const client = new GoogleGenAI({ apiKey });

    const [recentRecords, categoriesResponse] = await Promise.all([
      this.walletService.getRecentRecords(20),
      this.walletService.getCategories(),
    ]);

    const allCategories = categoriesResponse.categories;
    const usedCategoryIds = new Set(recentRecords.map((r) => r.categoryId).filter(Boolean));
    let recentCategories = allCategories
      .filter((c) => usedCategoryIds.has(c.id))
      .map((c) => ({ id: c.id, name: c.name, groupName: c.envelope?.['groupName'] ?? (c as any).groupName ?? '' }));

    if (recentCategories.length === 0) {
      recentCategories = allCategories.slice(0, 20).map((c) => ({
        id: c.id,
        name: c.name,
        groupName: c.envelope?.['groupName'] ?? (c as { groupName: string }).groupName ?? '',
      }));
    }

    const fileStream = await this.storage.getStream(file.filename);
    const base64Content = await streamToBase64(fileStream);
    const mimeType = getMimeType(extname(file.originalName).toLowerCase() as FileExtension);

    this.logger.log(`Calling Gemini (${geminiModel}) to Wallet for execution #${executionId} with ${recentCategories.length} category hints`);

    const prompt = buildPrompt(recentCategories);

    const response = await client.models.generateContent({
      model: geminiModel,
      contents: [
        {
          role: 'user',
          parts: [{ inlineData: { mimeType, data: base64Content } }, { text: prompt }],
        },
      ],
      config: {
        responseMimeType: 'application/json',
      },
    });

    let extractedData: {
      amount: number;
      recordDate: string;
      note: string;
      extraction_scratchpad: string;
      categoryId: string
    };
    try {
      const responseText = response.text || '{}';
      extractedData = JSON.parse(responseText.trim()) as typeof extractedData;
      this.logger.log(`Extracted data for execution #${executionId} is ${JSON.stringify(extractedData)}`);
    } catch (err) {
      this.logger.error(`Failed to parse Gemini response as JSON: ${response.text}`, err);
      throw new Error('Invalid JSON response from Gemini');
    }

    const amountValue = extractedData.amount || 0;
    let recordDate = extractedData.recordDate;
    const now = new Date();
    if (!recordDate) {
      recordDate = now.toISOString().split('.')[0] + 'Z';
    } else {
      const parsedDate = new Date(recordDate);
      const twoMonthsAgo = new Date();
      twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);

      if (parsedDate < twoMonthsAgo) {
        this.logger.log(`Record date ${recordDate} is older than 2 months, defaulting to today.`);
        recordDate = now.toISOString().split('.')[0] + 'Z';
      }
    }
    const note = extractedData.note ? extractedData.note.substring(0, 255) : '';
    const categoryId = extractedData.categoryId || '';

    const payload: WalletRecordPayload[] = [
      {
        extraction_scratchpad: extractedData.extraction_scratchpad,
        amount: {
          value: amountValue,
        },
        categoryId,
        note,
        paymentType: 'cash',
        recordDate,
      },
    ];

    this.logger.log(`OCR complete for file #${file.id} (execution #${executionId}), category suggested: ${categoryId}`);

    return JSON.stringify(payload);
  }
}
