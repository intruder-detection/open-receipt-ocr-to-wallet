import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { CreateWalletRecordDto } from './dto/create-wallet-record.dto';
import { SecretProvider } from '@core/secrets/secret-provider.interface';
import { AppSecret } from '@core/types/app-secret.enum';
import { OcrFilesDao } from '@core/database/daos/ocr-files.dao';
import { NoTxn } from '@core/database/txn-def.interface';

export interface WalletAccount {
  id: string;
  name: string;
  [key: string]: any;
}

export interface WalletCategory {
  id: string;
  name: string;
  [key: string]: any;
}

export interface WalletPaginatedResponse {
  limit?: number;
  offset?: number;
  nextOffset?: number;
  total?: number | null;
}

export interface GetAccountsResponse extends WalletPaginatedResponse {
  accounts: WalletAccount[];
}

export interface GetCategoriesResponse extends WalletPaginatedResponse {
  categories: WalletCategory[];
}

export interface WalletBatchSummary {
  total: number;
  succeeded: number;
  clientErrors: number;
  serverErrors: number;
}

export interface WalletRecordResult {
  inputIndex: number;
  success: boolean;
  error?: string;
  errorType?: string;
  id?: string;
  record?: any;
}

export interface CreateRecordsResponse {
  summary: WalletBatchSummary;
  results?: WalletRecordResult[];
}

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);
  private readonly baseUrl = 'https://rest.budgetbakers.com/wallet';

  private cachedAccounts: GetAccountsResponse | null = null;
  private cachedAccountsTime = 0;
  private cachedCategories: GetCategoriesResponse | null = null;
  private cachedCategoriesTime = 0;
  private readonly CACHE_TTL = 60 * 60 * 1000; // 1 hour

  constructor(
    private secretProvider: SecretProvider,
    private ocrFilesDao: OcrFilesDao,
  ) {}

  private async getHeaders() {
    const token = (await this.secretProvider.getSecret(AppSecret.BudgetBakersToken)) || '';

    this.logger.log('Token: ', token);

    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
  }

  async getAccounts(): Promise<GetAccountsResponse> {
    const now = Date.now();
    if (this.cachedAccounts && now - this.cachedAccountsTime < this.CACHE_TTL) {
      this.logger.debug('Returning cached accounts');
      return this.cachedAccounts;
    }

    try {
      const headers = await this.getHeaders();
      const response = await fetch(`${this.baseUrl}/v1/api/accounts`, { headers });
      if (!response.ok) {
        throw new Error(`Failed to fetch accounts: ${response.statusText}`);
      }
      const data = (await response.json()) as GetAccountsResponse;
      this.cachedAccounts = data;
      this.cachedAccountsTime = now;
      return data;
    } catch (error) {
      this.logger.error('Error fetching accounts from BudgetBakers', error);
      throw new HttpException('Failed to fetch accounts', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getCategories(): Promise<GetCategoriesResponse> {
    const now = Date.now();
    if (this.cachedCategories && now - this.cachedCategoriesTime < this.CACHE_TTL) {
      this.logger.debug('Returning cached categories');
      return this.cachedCategories;
    }

    try {
      const headers = await this.getHeaders();
      const response = await fetch(`${this.baseUrl}/v1/api/categories`, { headers });
      if (!response.ok) {
        throw new Error(`Failed to fetch categories: ${response.statusText}`);
      }
      const data = (await response.json()) as GetCategoriesResponse;
      this.cachedCategories = data;
      this.cachedCategoriesTime = now;
      return data;
    } catch (error) {
      this.logger.error('Error fetching categories from BudgetBakers', error);
      throw new HttpException('Failed to fetch categories', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async createRecord(dto: CreateWalletRecordDto): Promise<CreateRecordsResponse> {
    try {
      // The current Date in the format presented in the example
      // e.g. "2025-03-15T14:30:00Z"
      const recordDate = new Date().toISOString().split('.')[0] + 'Z';

      const note = dto.note && dto.note.length > 255 ? dto.note.substring(0, 252) + '...' : dto.note;

      const payload = [
        {
          accountId: dto.accountId,
          amount: {
            value: 0.01,
          },
          categoryId: dto.categoryId,
          note: note,
          paymentType: 'cash',
          recordDate,
        },
      ];

      const headers = await this.getHeaders();
      const response = await fetch(`${this.baseUrl}/v1/api/records`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to create record: ${response.statusText} - ${text}`);
      }

      const responseBody = (await response.json()) as CreateRecordsResponse;

      // BudgetBakers returns a success status code but with an error in the results array
      if (responseBody.results && responseBody.results.length > 0) {
        const result = responseBody.results[0];
        if (result.success !== true) {
          throw new Error(result.error || 'Unknown error occurred while creating record');
        }

        // Successfully created the record in Wallet, now save the association to the file
        if (result.id) {
          const walletRecordData = {
            id: result.id,
            accountId: dto.accountId,
            categoryId: dto.categoryId,
            amount: 0.01,
            note: note,
            recordDate,
          };
          await this.ocrFilesDao.updateByPk(NoTxn, dto.fileId, {
            walletRecordId: result.id,
            walletRecord: walletRecordData,
          });
          this.logger.log(`Associated Wallet Record ${result.id} with OCR File ${dto.fileId}`);
        }
      }

      return responseBody;
    } catch (error) {
      this.logger.error('Error creating record in BudgetBakers', error);
      throw new HttpException(error instanceof Error ? error.message : 'Failed to create record', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
