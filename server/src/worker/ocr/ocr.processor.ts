import { OnModuleInit, Logger } from '@nestjs/common';
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { StorageProvider } from '@core/storage/storage-provider.interface';
import { QueueName } from '@core/types/queue-name.enum';
import { OcrProvider } from '@core/types/ocr-provider.enum';

import { OcrExecutionsDao } from '@core/database/daos/ocr-executions.dao';
import { OcrFilesDao } from '@core/database/daos/ocr-files.dao';
import { OcrJobsDao } from '@core/database/daos/ocr-jobs.dao';
import { OcrExecutionStatus, OcrFileStatus, OcrJobStatus } from '@open-receipt-ocr/types';
import { NoTxn, WithTxn } from '@core/database/txn-def.interface';
import { DbService } from '@core/database/db.service';
import { MistralProcessor } from '@worker/ocr/mistral.processor';
import { TabScannerProcessor } from '@worker/ocr/tabscanner.processor';
import { PaddleOcrApiProcessor } from '@worker/ocr/paddle-ocr-api.processor';
import { PaddleOcrLocalProcessor } from '@worker/ocr/paddle-ocr-local.processor';
import { GeminiProcessor } from '@worker/ocr/gemini.processor';
import { TextractProcessor } from '@worker/ocr/textract.processor';
import { GrokProcessor } from '@worker/ocr/grok.processor';
import { TesseractProcessor } from '@worker/ocr/tesseract.processor';
import { OpenAiProcessor } from '@worker/ocr/openai.processor';
import { LlamaCppProcessor } from '@worker/ocr/llama-cpp.processor';
import { GeminiToWalletProcessor } from '@worker/ocr/wallet/gemini-to-wallet.processor';

@Processor(QueueName.Ocr)
export class OcrProcessor extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(OcrProcessor.name);

  constructor(
    private readonly ocrExecutionsDao: OcrExecutionsDao,
    private readonly ocrFilesDao: OcrFilesDao,
    private readonly ocrJobsDao: OcrJobsDao,
    private readonly storage: StorageProvider,
    private readonly db: DbService,
    private readonly mistralProcessor: MistralProcessor,
    private readonly tabScannerProcessor: TabScannerProcessor,
    private readonly paddleOcrApiProcessor: PaddleOcrApiProcessor,
    private readonly paddleOcrLocalProcessor: PaddleOcrLocalProcessor,
    private readonly geminiProcessor: GeminiProcessor,
    private readonly textractProcessor: TextractProcessor,
    private readonly grokProcessor: GrokProcessor,
    private readonly tesseractProcessor: TesseractProcessor,
    private readonly openAiProcessor: OpenAiProcessor,
    private readonly llamaCppProcessor: LlamaCppProcessor,
    private readonly geminiToWalletProcessor: GeminiToWalletProcessor,
  ) {
    super();
  }

  onModuleInit() {
    this.logger.log(`👷 OCR Processor initialized and listening on queue: ${QueueName.Ocr}`);
  }

  @OnWorkerEvent('active')
  onWorkerActive(job: Job) {
    this.logger.debug(`🏃 Job ${job.id} started processing...`);
  }

  @OnWorkerEvent('completed')
  onWorkerCompleted(job: Job) {
    this.logger.debug(`✅ Job ${job.id} completed successfully.`);
  }

  @OnWorkerEvent('failed')
  onWorkerFailed(job: Job, error: Error) {
    this.logger.error(`❌ Job ${job.id} failed with error: ${error.message}`);
  }

  async process(job: Job<{ executionId: number }>): Promise<void> {
    const { executionId } = job.data;
    this.logger.log(`Processing OCR for execution #${executionId}`);

    const execution = await this.ocrExecutionsDao.getOneByPk(NoTxn, executionId);
    if (!execution) {
      this.logger.error(`Execution #${executionId} not found — skipping`);
      return;
    }

    const file = await this.ocrFilesDao.getOneByPk(NoTxn, execution.fileId);
    if (!file) {
      this.logger.error(`File #${execution.fileId} for execution #${executionId} not found — skipping`);
      return;
    }

    try {
      await this.db.transaction(async (em) => {
        const txn = WithTxn(em);

        await this.ocrExecutionsDao.updateByPk(txn, executionId, { status: OcrExecutionStatus.Running });
        await this.ocrFilesDao.updateByPk(txn, file.id, { status: OcrFileStatus.Processing });
      });

      const fileExists = await this.storage.exists(file.filename);
      if (!fileExists) {
        throw new Error(`File not found in storage: ${file.filename}`);
      }

      let ocrData: string;

      switch (execution.ocrProvider) {
        case OcrProvider.Mistral:
          ocrData = await this.mistralProcessor.process(file, executionId);
          break;
        case OcrProvider.TabScanner:
          ocrData = await this.tabScannerProcessor.process(file, executionId);
          break;
        case OcrProvider.PaddleOcrApi:
          ocrData = await this.paddleOcrApiProcessor.process(file, executionId);
          break;
        case OcrProvider.PaddleOcrLocal:
          ocrData = await this.paddleOcrLocalProcessor.process(file, executionId);
          break;
        case OcrProvider.Gemini:
          ocrData = await this.geminiProcessor.process(file, executionId);
          break;
        case OcrProvider.AwsTextract:
          ocrData = await this.textractProcessor.process(file, executionId);
          break;
        case OcrProvider.Grok:
          ocrData = await this.grokProcessor.process(file, executionId);
          break;
        case OcrProvider.Tesseract:
          ocrData = await this.tesseractProcessor.process(file, executionId);
          break;
        case OcrProvider.OpenAi:
          ocrData = await this.openAiProcessor.process(file, executionId);
          break;
        case OcrProvider.LlamaCpp:
          ocrData = await this.llamaCppProcessor.process(file, executionId);
          break;
        case OcrProvider.GeminiToWallet:
          ocrData = await this.geminiToWalletProcessor.process(file, executionId);
          break;
        default:
          throw new Error(`OCR Provider "${execution.ocrProvider as string}" is not yet implemented.`);
      }

      await this.db.transaction(async (em) => {
        const txn = WithTxn(em);

        await this.ocrExecutionsDao.updateByPk(txn, executionId, {
          status: OcrExecutionStatus.Completed,
          ocrData,
        });

        await this.ocrFilesDao.updateByPk(txn, file.id, {
          status: OcrFileStatus.Completed,
        });

        // Update Job status to Completed if all files are completed
        const job = await this.ocrJobsDao.findOneWithRelations(txn, file.jobId);
        if (job && job.files.every((f) => f.status === OcrFileStatus.Completed)) {
          await this.ocrJobsDao.updateByPk(txn, job.id, { status: OcrJobStatus.Completed });
        }
      });

      this.logger.log(`Successfully completed OCR for execution #${executionId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`OCR failed for execution #${executionId}: ${message}`);

      await this.db.transaction(async (em) => {
        const txn = WithTxn(em);

        await this.ocrExecutionsDao.updateByPk(txn, executionId, {
          status: OcrExecutionStatus.Failed,
          errorMessage: message,
        });

        await this.ocrFilesDao.updateByPk(txn, file.id, {
          status: OcrFileStatus.Failed,
        });

        await this.ocrJobsDao.updateByPk(txn, file.jobId, { status: OcrJobStatus.Failed });
      });

      throw error;
    }
  }
}
