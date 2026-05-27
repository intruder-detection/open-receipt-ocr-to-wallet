import { Inject, Injectable, Logger } from '@nestjs/common';
import { GoogleGenAI } from '@google/genai';
import { extname } from 'path';
import { AppSecret } from '@core/types/app-secret.enum';
import { SecretProvider } from '@core/secrets/secret-provider.interface';
import { StorageProvider } from '@core/storage/storage-provider.interface';
import { FileExtension } from '@open-receipt-ocr/types';
import { OcrFileEntity } from '@core/database/entities/ocr-file.entity';
import { getMimeType } from '@worker/ocr/utils/mime-type.util';
import { streamToBase64 } from '@worker/ocr/utils/stream.util';
import { OcrJobsDao } from '@core/database/daos/ocr-jobs.dao';
import { NoTxn } from '@core/database/txn-def.interface';
import { WalletService, WalletRecordPayload } from '@app/wallet/wallet.service';

const OCR_PROMPT = `
You are an OCR and data extraction engine. 
Extract the following information from the provided receipt image and output the result strictly as a valid JSON object. 
No markdown blocks, no code fences, just raw JSON.
Required fields in the JSON object:
- "amount": a number representing the total amount paid on the receipt.
- "recordDate": a string representing the date of the receipt in ISO 8601 format (e.g. "2025-03-15T14:30:00Z"). If time is unknown, default to 12:00:00Z.
- "note": a string containing a brief summary or transcription of the receipt items, STRICTLY capped at 255 characters.

Example Output format:
{
  "amount": 12.34,
  "recordDate": "2025-03-15T12:00:00Z",
  "note": "Lunch at restaurant: 1x Burger, 1x Fries"
}
`;

@Injectable()
export class GeminiToWalletProcessor {
  private readonly logger = new Logger(GeminiToWalletProcessor.name);

  constructor(
    @Inject(SecretProvider) private readonly secretProvider: SecretProvider,
    private readonly storage: StorageProvider,
    private readonly ocrJobsDao: OcrJobsDao,
    private readonly walletService: WalletService,
  ) {}

  async process(file: OcrFileEntity, executionId: number): Promise<string> {
    const apiKey = await this.secretProvider.getSecretOrThrow(AppSecret.GeminiApiKey);
    const geminiModel = await this.secretProvider.getSecretOrThrow(AppSecret.GeminiModel);
    const client = new GoogleGenAI({ apiKey });

    const job = await this.ocrJobsDao.getOneByPk(NoTxn, file.jobId);
    if (!job) {
      throw new Error(`Job #${file.jobId} not found for file #${file.id}`);
    }

    const { accountId, categoryId } = job;
    if (!accountId || !categoryId) {
      throw new Error(`Missing accountId or categoryId in Job #${file.jobId} for Gemini To Wallet processor`);
    }

    const fileStream = await this.storage.getStream(file.filename);
    const base64Content = await streamToBase64(fileStream);
    const mimeType = getMimeType(extname(file.originalName).toLowerCase() as FileExtension);

    this.logger.log(`Calling Gemini (${geminiModel}) to Wallet for execution #${executionId}`);

    const response = await client.models.generateContent({
      model: geminiModel,
      contents: [
        {
          role: 'user',
          parts: [{ inlineData: { mimeType, data: base64Content } }, { text: OCR_PROMPT }],
        },
      ],
      config: {
        responseMimeType: 'application/json',
      },
    });

    let extractedData: { amount: number; recordDate: string; note: string };
    try {
      const responseText = response.text || '{}';
      extractedData = JSON.parse(responseText.trim()) as { amount: number; recordDate: string; note: string };
    } catch (err) {
      this.logger.error(`Failed to parse Gemini response as JSON: ${response.text}`, err);
      throw new Error('Invalid JSON response from Gemini');
    }

    const amountValue = extractedData.amount || 0;
    const recordDate = extractedData.recordDate || new Date().toISOString().split('.')[0] + 'Z';
    const note = extractedData.note ? extractedData.note.substring(0, 255) : '';

    const payload: WalletRecordPayload[] = [
      {
        accountId,
        amount: {
          value: amountValue,
        },
        categoryId,
        note,
        paymentType: 'cash',
        recordDate,
      },
    ];

    const useWalletStr = await this.secretProvider.getSecret(AppSecret.UseWalletOcrProcessorProvider);
    if (useWalletStr === 'true') {
      this.logger.log(`USE_WALLET_OCR_PROCESSOR_PROVIDER is true. Inserting payload into Wallet for file #${file.id}`);
      await this.walletService.createRecordFromPayload(payload, file.id);

      // Return the JSON string array as requested
      return JSON.stringify(payload);
    }

    return 'USE_WALLET_OCR_PROCESSOR_PROVIDER is not set to true. Skipping Wallet insertion.';
  }
}
