import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { DatabaseModule } from '@core/database/database.module';
import { SecretsModule } from '@core/secrets/secrets.module';
import { StorageModule } from '@core/storage/storage.module';
import { OcrJobsModule } from '@app/ocr-jobs/ocr-jobs.module';
import { WalletModule } from '@app/wallet/wallet.module';
import { SecretProvider } from '@core/secrets/secret-provider.interface';
import { AppSecret } from '@core/types/app-secret.enum';
import { QueueName } from '@core/types/queue-name.enum';
import { OcrProcessor } from '@worker/ocr/ocr.processor';
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

@Module({
  imports: [
    SecretsModule,
    DatabaseModule,
    StorageModule,
    BullModule.forRootAsync({
      imports: [SecretsModule],
      inject: [SecretProvider],
      useFactory: async (secretProvider: SecretProvider) => ({
        connection: {
          host: await secretProvider.getSecretOrThrow(AppSecret.RedisHost),
          port: await secretProvider.getSecretAsIntOrThrow(AppSecret.RedisPort),
        },
      }),
    }),
    OcrJobsModule,
    BullModule.registerQueue({ name: QueueName.Ocr }),
    WalletModule,
  ],
  providers: [
    OcrProcessor,
    MistralProcessor,
    TabScannerProcessor,
    PaddleOcrApiProcessor,
    PaddleOcrLocalProcessor,
    GeminiProcessor,
    TextractProcessor,
    GrokProcessor,
    TesseractProcessor,
    OpenAiProcessor,
    LlamaCppProcessor,
    GeminiToWalletProcessor,
  ],
})
export class WorkerModule {}
