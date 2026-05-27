import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { DbService } from '@core/database/db.service';
import { NoTxn, WithTxn } from '@core/database/txn-def.interface';
import { Readable } from 'stream';
import type { Request } from 'express';
import { QueueService } from '@core/queue/queue.service';
import { SecretProvider } from '@core/secrets/secret-provider.interface';
import { StorageProvider } from '@core/storage/storage-provider.interface';
import { AppSecret } from '@core/types/app-secret.enum';
import { ALLOWED_MIME_TYPES, DEFAULT_MAX_FILE_SIZE_BYTES } from '@core/constants/media.constants';
import { parseMultipartStream } from '@core/utils/multipart.util';

import { OcrProvider } from '@core/types/ocr-provider.enum';

import { OcrJobsDao } from '@core/database/daos/ocr-jobs.dao';
import { OcrFilesDao } from '@core/database/daos/ocr-files.dao';
import { OcrExecutionsDao } from '@core/database/daos/ocr-executions.dao';
import { OcrJobEntity } from '@core/database/entities/ocr-job.entity';
import { OcrExecutionEntity } from '@core/database/entities/ocr-execution.entity';
import { OcrExecutionStatus, OcrFileStatus, OcrJobStatus, SortOrder } from '@open-receipt-ocr/types';
import { OcrFileEntity } from '@core/database/entities/ocr-file.entity';

@Injectable()
export class OcrJobsService {
  private readonly logger = new Logger(OcrJobsService.name);

  constructor(
    private readonly ocrJobsDao: OcrJobsDao,
    private readonly ocrFilesDao: OcrFilesDao,
    private readonly ocrExecutionsDao: OcrExecutionsDao,
    private readonly queueService: QueueService,
    private readonly secretProvider: SecretProvider,
    private readonly dbService: DbService,
    @Inject(StorageProvider) private readonly storage: StorageProvider,
  ) {}

  findAllJobs(
    page?: number,
    pageSize?: number,
    status?: OcrJobStatus,
    search?: string,
    sortField?: keyof OcrJobEntity | 'filesCount',
    sortOrder?: SortOrder,
  ): Promise<[OcrJobEntity[], number]> {
    const skip = page && pageSize ? (page - 1) * pageSize : undefined;
    return this.ocrJobsDao.findAllWithRelations(NoTxn, { skip, take: pageSize, status, search, sortField, sortOrder });
  }

  async upload(req: Request): Promise<OcrJobEntity> {
    const contentType = req.headers['content-type'];
    if (!contentType?.startsWith('multipart/form-data')) {
      throw new BadRequestException('Expected a multipart/form-data request.');
    }

    const maxSizeStr = await this.secretProvider.getSecret(AppSecret.MaxFileSizeBytes);
    const maxSizeBytes = maxSizeStr ? parseInt(maxSizeStr, 10) : DEFAULT_MAX_FILE_SIZE_BYTES;

    const parseResult = await parseMultipartStream(req, this.storage, {
      maxSizeBytes,
      allowedMimeTypes: ALLOWED_MIME_TYPES,
    });

    type FileAndOcrProvider = {
      file: Awaited<ReturnType<typeof parseMultipartStream>>['files'][0];
      ocrProvider: OcrProvider;
    };

    const files: FileAndOcrProvider[] = [];

    for (const [idx, file] of parseResult.files.entries()) {
      let ocrProvider: OcrProvider | undefined;

      const providerField = `ocrProvider_${idx}`;
      if (parseResult.fields[providerField] && Object.values(OcrProvider).includes(parseResult.fields[providerField] as OcrProvider)) {
        ocrProvider = parseResult.fields[providerField] as OcrProvider;
      }

      if (ocrProvider) {
        files.push({ file, ocrProvider });
      } else {
        this.logger.warn(
          `The given ocr provider for the file named ${file.originalName}, does not exist. Given: ${parseResult.fields[providerField]}. List of allowed OCR Providers is: ${Object.values(OcrProvider).join(', ')}`,
        );
        try {
          await this.storage.delete(file.key);
        } catch (err) {
          this.logger.error(`Failed to delete orphaned file ${file.key} from storage: ${(err as Error).message}`);
        }
      }
    }

    if (files.length === 0) {
      throw new BadRequestException('No valid files provided. Each file must have a valid ocrProvider_<index> field.');
    }

    const { ocrJob, executionsToQueue } = await this.dbService.transaction(async (em) => {
      const txn = WithTxn(em);

      const jobName = parseResult.fields['jobName'];
      const accountId = parseResult.fields['accountId'] as string | undefined;
      const categoryId = parseResult.fields['categoryId'] as string | undefined;
      const job = await this.ocrJobsDao.create(txn, {
        status: OcrJobStatus.Processing,
        name: jobName,
        accountId,
        categoryId,
      });

      const executions: { id: number; fileId: number }[] = [];

      for (const { file, ocrProvider } of files) {
        const ocrFile = await this.ocrFilesDao.create(txn, {
          jobId: job.id,
          filename: file.key,
          originalName: file.originalName,
          status: OcrFileStatus.Processing,
        });

        let extraData: Record<string, string> | undefined;
        if (ocrProvider === OcrProvider.GeminiToWallet) {
          const resolvedAccountId = accountId || (await this.secretProvider.getSecret(AppSecret.DefaultWalletAccountId));
          const resolvedCategoryId = categoryId || (await this.secretProvider.getSecret(AppSecret.DefaultWalletCategoryId));
          if (!resolvedAccountId || !resolvedCategoryId) {
            throw new BadRequestException(
              'GeminiToWallet provider requires accountId and categoryId. Provide them in the request or set DEFAULT_WALLET_ACCOUNT_ID and DEFAULT_WALLET_CATEGORY_ID env vars.',
            );
          }
          extraData = { accountId: resolvedAccountId, categoryId: resolvedCategoryId };
        }

        const execution = await this.ocrExecutionsDao.create(txn, {
          fileId: ocrFile.id,
          ocrProvider,
          status: OcrExecutionStatus.Pending,
          extraData,
        });

        executions.push({ id: execution.id, fileId: ocrFile.id });
      }

      return { ocrJob: job, executionsToQueue: executions };
    });

    for (const exec of executionsToQueue) {
      await this.queueService.addToOcrQueue({ executionId: exec.id });
      this.logger.log(`Execution #${exec.id} for File #${exec.fileId} queued for OCR`);
    }

    return ocrJob;
  }

  async getJob(id: number): Promise<OcrJobEntity> {
    const job = await this.ocrJobsDao.findOneWithRelations(NoTxn, id);
    if (!job) {
      throw new BadRequestException(`OCR Job #${id} not found`);
    }
    return job;
  }

  async retry(fileId: number, ocrProvider: OcrProvider): Promise<OcrExecutionEntity> {
    const execution = await this.dbService.transaction(async (em) => {
      const txn = WithTxn(em);
      const file = await this.ocrFilesDao.getOneByPkOrFail(txn, fileId);

      const exec = await this.ocrExecutionsDao.create(txn, {
        fileId: file.id,
        ocrProvider,
        status: OcrExecutionStatus.Pending,
      });

      await this.ocrFilesDao.updateByPk(txn, fileId, {
        status: OcrFileStatus.Processing,
      });

      return exec;
    });

    await this.queueService.addToOcrQueue({ executionId: execution.id });
    this.logger.log(`New execution #${execution.id} for File #${fileId} queued for OCR (retry)`);
    return execution;
  }

  async getFileStream(key: string): Promise<Readable> {
    return this.storage.getStream(key);
  }

  async fileExists(key: string): Promise<boolean> {
    return this.storage.exists(key);
  }

  async getFileByKey(key: string): Promise<OcrFileEntity | null> {
    return this.ocrFilesDao.findByFilename(NoTxn, key);
  }

  async deleteJob(id: number): Promise<void> {
    const job = await this.ocrJobsDao.findOneWithRelations(NoTxn, id);
    if (!job) return;

    for (const file of job.files) {
      try {
        await this.storage.delete(file.filename);
      } catch (err) {
        this.logger.error(`Failed to delete file ${file.filename}: ${(err as Error).message}`);
      }
    }

    await this.ocrJobsDao.deleteByPk(NoTxn, id);
    this.logger.log(`OCR Job #${id} and associated files deleted`);
  }
}
