import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '@environments/environment';

export interface WalletAccount {
  id: string;
  name: string;
}

export interface WalletCategory {
  id: string;
  name: string;
  groupName?: string;
  envelope?: {
    groupName?: string;
  };
}

export interface WalletPaginatedResponse<T> {
  accounts?: T[];
  categories?: T[];
  items?: T[];
  data?: T[];
}

export interface WalletRecordResponse {
  summary: {
    total: number;
    succeeded: number;
    clientErrors: number;
    serverErrors: number;
  };
  results?: {
    inputIndex: number;
    success: boolean;
    error?: string;
    errorType?: string;
  }[];
}

@Injectable({
  providedIn: 'root',
})
export class WalletService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/wallet`;

  getAccounts(): Observable<WalletAccount[]> {
    return this.http.get<WalletPaginatedResponse<WalletAccount> | WalletAccount[]>(`${this.apiUrl}/accounts`).pipe(
      map((res) => {
        if (Array.isArray(res)) return res;
        return res.accounts || res.items || res.data || [];
      }),
    );
  }

  getCategories(): Observable<WalletCategory[]> {
    return this.http.get<WalletPaginatedResponse<WalletCategory> | WalletCategory[]>(`${this.apiUrl}/categories`).pipe(
      map((res) => {
        if (Array.isArray(res)) return res;
        return res.categories || res.items || res.data || [];
      }),
    );
  }

  createRecord(accountId: string, categoryId: string, note: string): Observable<WalletRecordResponse> {
    return this.http.post<WalletRecordResponse>(`${this.apiUrl}/records`, {
      accountId,
      categoryId,
      note,
    });
  }
}
