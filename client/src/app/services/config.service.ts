import { Injectable, signal } from '@angular/core';
import { Subject } from 'rxjs';
import { OcrProvider } from '@open-receipt-ocr/types';

@Injectable({
  providedIn: 'root',
})
export class ConfigService {
  defaultOcrProvider = signal<OcrProvider | undefined>(undefined);
  defaultOutputs = signal<string[]>(['db']);
  language = signal<string>('en');
  theme = signal<'light' | 'dark'>('light');
  sidebarCollapsed = signal<boolean>(false);
  walletAccountId = signal<string | null>(null);
  walletCategoryId = signal<string | null>(null);

  readonly openSettings$ = new Subject<void>();

  openSettings() {
    this.openSettings$.next();
  }

  private storageKey = 'open-receipt-ocr-config';

  constructor() {
    this.loadConfig();
  }

  loadConfig() {
    const data = localStorage.getItem(this.storageKey);
    if (data) {
      try {
        const config = JSON.parse(data) as {
          defaultOcrProvider?: OcrProvider;
          defaultOutputs?: string[];
          language?: string;
          theme?: 'light' | 'dark';
          sidebarCollapsed?: boolean;
          walletAccountId?: string;
          walletCategoryId?: string;
        };
        if (config.defaultOcrProvider) this.defaultOcrProvider.set(config.defaultOcrProvider);
        if (config.defaultOutputs) this.defaultOutputs.set(config.defaultOutputs);
        if (config.language) this.language.set(config.language);
        if (config.theme) this.theme.set(config.theme);
        if (config.sidebarCollapsed !== undefined) this.sidebarCollapsed.set(config.sidebarCollapsed);
        if (config.walletAccountId) this.walletAccountId.set(config.walletAccountId);
        if (config.walletCategoryId) this.walletCategoryId.set(config.walletCategoryId);
      } catch (err) {
        console.error('Failed to parse config from localStorage', err);
      }
    }
  }

  saveConfig() {
    localStorage.setItem(
      this.storageKey,
      JSON.stringify({
        defaultOcrProvider: this.defaultOcrProvider(),
        defaultOutputs: this.defaultOutputs(),
        language: this.language(),
        theme: this.theme(),
        sidebarCollapsed: this.sidebarCollapsed(),
        walletAccountId: this.walletAccountId(),
        walletCategoryId: this.walletCategoryId(),
      }),
    );
  }
}
