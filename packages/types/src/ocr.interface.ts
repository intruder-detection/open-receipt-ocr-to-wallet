import { OcrProvider } from './ocr-provider.enum';
import { OcrExecutionStatus, OcrFileStatus, OcrJobStatus } from './ocr-status.enum';

export interface OcrExecution {
  id: number;
  fileId: number;
  ocrProvider: OcrProvider;
  ocrData?: string | null;
  status: OcrExecutionStatus;
  errorMessage?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OcrFile {
  id: number;
  jobId: number;
  filename: string;
  originalName: string;
  status: OcrFileStatus;
  executions?: OcrExecution[];
  walletRecordId?: string | null;
  walletRecord?: {
    id: string;
    accountId: string;
    categoryId: string;
    amount: number;
    note: string;
    recordDate: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface OcrJob {
  id: number;
  status: OcrJobStatus;
  name?: string | null;
  files?: OcrFile[];
  createdAt: string;
  updatedAt: string;
}
