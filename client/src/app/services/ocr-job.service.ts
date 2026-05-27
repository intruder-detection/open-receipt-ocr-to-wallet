import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { OcrProvider, OcrJob, OcrExecution, PaginatedResponse, OcrJobStatus, SortOrder } from '@open-receipt-ocr/types';
import { Observable, tap } from 'rxjs';
import { environment } from '@environments/environment';

export const LOCAL_PROVIDERS = new Set<OcrProvider>([OcrProvider.LlamaCpp, OcrProvider.Tesseract, OcrProvider.PaddleOcrLocal]);

export const OCR_PROVIDER_ICONS: Record<OcrProvider, string> = {
  [OcrProvider.Mistral]: 'pi pi-sparkles',
  [OcrProvider.TabScanner]: 'pi pi-bolt',
  [OcrProvider.PaddleOcrLocal]: 'pi pi-desktop',
  [OcrProvider.PaddleOcrApi]: 'pi pi-cloud',
  [OcrProvider.Gemini]: 'pi pi-google',
  [OcrProvider.AwsTextract]: 'pi pi-amazon',
  [OcrProvider.Grok]: 'pi pi-twitter',
  [OcrProvider.Tesseract]: 'pi pi-eye',
  [OcrProvider.OpenAi]: 'pi pi-openai',
  [OcrProvider.LlamaCpp]: 'pi pi-microchip-ai',
  [OcrProvider.GeminiToWallet]: 'pi pi-wallet',
};

@Injectable({
  providedIn: 'root',
})
export class OcrJobService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/ocr-jobs`;

  // State using Signal
  jobs = signal<OcrJob[]>([]);
  totalCount = signal<number>(0);
  loading = signal<boolean>(false);

  fetchJobs(showLoading = true, page?: number, pageSize?: number, status?: OcrJobStatus, search?: string, sortField?: string, sortOrder?: SortOrder) {
    if (showLoading) {
      this.loading.set(true);
    }

    const params: Record<string, string | number | boolean> = {};
    if (page !== undefined && pageSize !== undefined) {
      params['page'] = page;
      params['pageSize'] = pageSize;
    }
    if (status) {
      params['status'] = status;
    }
    if (search) {
      params['search'] = search;
    }
    if (sortField) {
      params['sortField'] = sortField;
    }
    if (sortOrder) {
      params['sortOrder'] = sortOrder;
    }

    return this.http
      .get<PaginatedResponse<OcrJob>>(this.apiUrl, { params })
      .pipe(
        tap((res) => {
          this.jobs.set(res.data);
          this.totalCount.set(res.total);
          this.loading.set(false);
        }),
      )
      .subscribe();
  }

  uploadJob(files: File[], providers: OcrProvider[], jobName?: string, accountId?: string, categoryId?: string) {
    const formData = new FormData();
    if (jobName) {
      formData.append('jobName', jobName);
    }
    if (accountId) {
      formData.append('accountId', accountId);
    }
    if (categoryId) {
      formData.append('categoryId', categoryId);
    }
    files.forEach((file, index) => {
      formData.append('files', file);
      formData.append(`ocrProvider_${index}`, providers[index]);
    });
    return this.http.post<{ id: number }>(`${this.apiUrl}/upload`, formData);
  }

  getJob(id: number): Observable<OcrJob> {
    return this.http.get<OcrJob>(`${this.apiUrl}/${id}`);
  }

  getFileUrl(key: string): string {
    return `${this.apiUrl}/uploads/${key}`;
  }

  reprocessFile(fileId: number, ocrProvider: OcrProvider): Observable<OcrExecution> {
    return this.http.post<OcrExecution>(`${this.apiUrl}/files/${fileId}/reprocess`, { ocrProvider });
  }

  deleteJob(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
