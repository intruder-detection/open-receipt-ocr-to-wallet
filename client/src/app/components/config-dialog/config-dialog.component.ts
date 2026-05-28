import { Component, ElementRef, EventEmitter, Input, OnChanges, Output, SimpleChanges, ViewChild, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { ConfigService } from '@services/config.service';
import { WalletService, WalletConfigResponse } from '@services/wallet.service';
import { OCR_PROVIDER_ICONS, LOCAL_PROVIDERS } from '@services/ocr-job.service';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { OcrProvider } from '@open-receipt-ocr/types';

@Component({
  selector: 'app-config-dialog',
  standalone: true,
  imports: [CommonModule, DialogModule, ButtonModule, SelectModule, FormsModule, TranslocoModule],
  templateUrl: './config-dialog.component.html',
})
export class ConfigDialogComponent implements OnChanges {
  configService: ConfigService = inject(ConfigService);
  private walletService = inject(WalletService);
  private translocoService = inject(TranslocoService);

  walletConfig: WalletConfigResponse | null = null;

  @Input() visible = false;
  @Output() visibleChange = new EventEmitter<boolean>();

  @ViewChild('arrowContainer') containerEl!: ElementRef<HTMLElement>;

  arrows = signal<{ d: string; key: string }[]>([]);

  ngOnChanges(changes: SimpleChanges) {
    if (changes['visible']?.currentValue) {
      setTimeout(() => this.updateArrows(), 60);
      this.loadWalletConfig();
    }
  }

  private loadWalletConfig() {
    this.walletService.getConfig().subscribe((config) => {
      this.walletConfig = config;
    });
  }

  get ocrOptionGroups() {
    const local: { label: string; value: OcrProvider | undefined; icon: string }[] = [
      { label: this.translocoService.translate('config.providers.none'), value: undefined, icon: 'pi pi-question-circle' },
    ];
    const online: { label: string; value: OcrProvider | undefined; icon: string }[] = [];
    for (const p of Object.values(OcrProvider)) {
      const opt = { label: this.translocoService.translate(`config.providers.${p}`), value: p, icon: OCR_PROVIDER_ICONS[p] };
      (LOCAL_PROVIDERS.has(p) ? local : online).push(opt);
    }
    return [
      { label: this.translocoService.translate('config.groups.local'), items: local },
      { label: this.translocoService.translate('config.groups.online'), items: online },
    ];
  }

  get outputOptions() {
    return [{ label: this.translocoService.translate('config.outputs.db'), value: 'db', icon: 'pi pi-database' }];
  }

  get languageOptions() {
    return [
      { label: this.translocoService.translate('config.languages.en'), value: 'en' },
      { label: this.translocoService.translate('config.languages.pt'), value: 'pt' },
      { label: this.translocoService.translate('config.languages.fr'), value: 'fr' },
      { label: this.translocoService.translate('config.languages.de'), value: 'de' },
    ];
  }

  get themeOptions() {
    return [
      { label: this.translocoService.translate('config.themes.light'), value: 'light', icon: 'pi pi-sun' },
      { label: this.translocoService.translate('config.themes.dark'), value: 'dark', icon: 'pi pi-moon' },
    ];
  }

  get sidebarOptions() {
    return [
      { label: this.translocoService.translate('config.sidebar.expanded'), value: false, icon: 'pi pi-window-maximize' },
      { label: this.translocoService.translate('config.sidebar.collapsed'), value: true, icon: 'pi pi-window-minimize' },
    ];
  }

  updateArrows() {
    if (!this.visible) {
      this.arrows.set([]);
      return;
    }
    const container = this.containerEl?.nativeElement;
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    if (!containerRect.width) return;

    const allArrows: { d: string; key: string }[] = [];

    // ── Arrow 1: Input → selected OCR Provider ──────────────────
    const inputEl = container.querySelector<HTMLElement>('[data-input-node]');
    const selectedProviderEl = container.querySelector<HTMLElement>('[data-sel-provider]');

    if (inputEl && selectedProviderEl) {
      const inRect = inputEl.getBoundingClientRect();
      const prvRect = selectedProviderEl.getBoundingClientRect();

      const x1 = inRect.right - containerRect.left + 2;
      const y1 = inRect.top + inRect.height / 2 - containerRect.top;
      const x2 = prvRect.left - containerRect.left - 2;
      const y2 = prvRect.top + prvRect.height / 2 - containerRect.top;
      const cpX = x1 + (x2 - x1) * 0.45;

      allArrows.push({
        d: `M ${x1} ${y1} C ${cpX} ${y1} ${cpX} ${y2} ${x2} ${y2}`,
        key: 'input-provider',
      });
    }

    // ── Arrows: selected OCR Provider → each selected Output ────
    if (selectedProviderEl) {
      const provRect = selectedProviderEl.getBoundingClientRect();
      const startX = provRect.right - containerRect.left + 2;
      const startY = provRect.top + provRect.height / 2 - containerRect.top;

      const selectedOutputEls = Array.from(container.querySelectorAll<HTMLElement>('[data-sel-output]'));
      selectedOutputEls.forEach((el) => {
        const outRect = el.getBoundingClientRect();
        const endX = outRect.left - containerRect.left - 2;
        const endY = outRect.top + outRect.height / 2 - containerRect.top;
        const cpX = startX + (endX - startX) * 0.45;
        allArrows.push({
          d: `M ${startX} ${startY} C ${cpX} ${startY} ${cpX} ${endY} ${endX} ${endY}`,
          key: `provider-${el.getAttribute('data-output-val') ?? ''}`,
        });
      });
    }

    this.arrows.set(allArrows);
  }

  setOcrProvider(value: OcrProvider | undefined) {
    this.configService.defaultOcrProvider.set(value);
    setTimeout(() => this.updateArrows(), 60);
  }

  close() {
    this.visibleChange.emit(false);
  }

  resetToDefaults() {
    this.configService.defaultOcrProvider.set(OcrProvider.Mistral);
    this.configService.language.set('en');
    this.configService.theme.set('light');
    this.configService.sidebarCollapsed.set(false);
    setTimeout(() => this.updateArrows(), 60);
  }

  save() {
    this.configService.saveConfig();
    this.close();
  }
}
