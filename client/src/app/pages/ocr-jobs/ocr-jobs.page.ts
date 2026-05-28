import { Component, effect, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { OcrJobService, OCR_PROVIDER_ICONS, LOCAL_PROVIDERS } from '@services/ocr-job.service';
import { WalletService, WalletAccount, WalletCategory, WalletRecordPayload } from '@services/wallet.service';
import { ConfigService } from '@services/config.service';
import { OcrOutputParserService } from '@app/pipes/parsers/ocr-output-parser.service';
import {
  OcrJob,
  OcrFile,
  OcrExecution,
  OcrJobStatus,
  OcrExecutionStatus,
  OcrProvider,
  FileExtension,
  ImageExtensions,
  SortOrder,
} from '@open-receipt-ocr/types';
import { interval, Subscription } from 'rxjs';
import { UploadDialogComponent } from '@components/upload-dialog/upload-dialog.component';

import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { DialogModule } from 'primeng/dialog';
import { ToastModule } from 'primeng/toast';
import { MessageService, ConfirmationService } from 'primeng/api';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { TooltipModule } from 'primeng/tooltip';
import { PopoverModule } from 'primeng/popover';
import { PaginatorModule } from 'primeng/paginator';
import { TableModule } from 'primeng/table';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { OcrOutputPipe } from '@app/pipes/ocr-output.pipe';
import { FormsModule } from '@angular/forms';
import { marked } from 'marked';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';

@Component({
  selector: 'app-ocr-jobs-page',
  standalone: true,
  imports: [
    CommonModule,
    DatePipe,
    CardModule,
    ButtonModule,
    TagModule,
    ProgressSpinnerModule,
    DialogModule,
    UploadDialogComponent,
    ToastModule,
    TranslocoModule,
    ConfirmDialogModule,
    TooltipModule,
    PopoverModule,
    PaginatorModule,
    OcrOutputPipe,
    FormsModule,
    IconFieldModule,
    InputIconModule,
    InputTextModule,
    SelectModule,
    TableModule,
  ],
  templateUrl: './ocr-jobs.page.html',
})
export class OcrJobsPageComponent implements OnInit, OnDestroy {
  ocrJobService = inject(OcrJobService);
  private messageService = inject(MessageService);
  private translocoService = inject(TranslocoService);
  private confirmationService = inject(ConfirmationService);
  private sanitizer = inject(DomSanitizer);
  private ocrOutputParser = inject(OcrOutputParserService);
  private walletService = inject(WalletService);
  private configService = inject(ConfigService);

  private pollingSubscription?: Subscription;
  private detailPollingSubscription?: Subscription;

  OcrJobStatus = OcrJobStatus;
  OcrExecutionStatus = OcrExecutionStatus;
  OcrProvider = OcrProvider;

  showUploadDialog = false;
  private _showDetail = false;
  get showDetail() {
    return this._showDetail;
  }
  set showDetail(value: boolean) {
    this._showDetail = value;
    if (!value) {
      this.stopDetailPolling();
      this.selectedJob = null;
      this.selectedFile = null;
      this.safeUrl = null;
    }
  }
  selectedJob: OcrJob | null = null;
  private _selectedFile: OcrFile | null = null;
  safeUrl: SafeResourceUrl | null = null;

  first = 0;
  rows = 20;

  searchQuery = '';
  filterStatus: OcrJobStatus | null = null;
  sortField: 'id' | 'name' | 'createdAt' | 'status' | 'filesCount' = 'createdAt';
  sortOrderDir: SortOrder = SortOrder.DESC;
  viewMode: 'grid' | 'list' = (localStorage.getItem('ocr-jobs-view-mode') as 'grid' | 'list') || 'grid';

  // Dropdown shortcut — plain field (two-way bound). Kept in sync with
  // sortField/sortOrderDir via onSortChange() and onTableSort().
  sortOrder: 'latest' | 'oldest' | null = 'latest';
  get viewOptions() {
    return [
      { label: this.translocoService.translate('ocrJobs.view.cards'), value: 'grid', icon: 'pi pi-th-large' },
      { label: this.translocoService.translate('ocrJobs.view.table'), value: 'list', icon: 'pi pi-list' },
    ];
  }

  onViewModeChange(mode: 'grid' | 'list') {
    this.viewMode = mode;
    localStorage.setItem('ocr-jobs-view-mode', mode);
  }

  get statusOptions() {
    return [
      { label: this.translocoService.translate('ocrJobs.filters.statusAll'), value: null },
      { label: this.translocoService.translate('ocrJobs.status.pending'), value: OcrJobStatus.Pending },
      { label: this.translocoService.translate('ocrJobs.status.processing'), value: OcrJobStatus.Processing },
      { label: this.translocoService.translate('ocrJobs.status.completed'), value: OcrJobStatus.Completed },
      { label: this.translocoService.translate('ocrJobs.status.failed'), value: OcrJobStatus.Failed },
    ];
  }

  get sortOptions() {
    return [
      { label: this.translocoService.translate('ocrJobs.filters.latest'), value: 'latest' },
      { label: this.translocoService.translate('ocrJobs.filters.oldest'), value: 'oldest' },
    ];
  }

  get providerGroups() {
    const all = Object.values(OcrProvider);
    return [
      { label: 'Local', providers: all.filter((p) => LOCAL_PROVIDERS.has(p)) },
      { label: 'Online', providers: all.filter((p) => !LOCAL_PROVIDERS.has(p)) },
    ];
  }

  getProviderIcon(provider: OcrProvider): string {
    return OCR_PROVIDER_ICONS[provider] || 'pi pi-sparkles';
  }

  imageLoading = signal(false);
  selectedExecution: OcrExecution | null = null;

  get selectedFile() {
    return this._selectedFile;
  }
  set selectedFile(file: OcrFile | null) {
    this._selectedFile = file;
    this.selectedExecution = this.getLatestExecution(file) || null;
    this.safeUrl = file ? this.getSafeUrl(file.filename) : null;
    this.imageLoading.set(!!file && this.isFileImage(file.originalName));
  }

  // Wallet Dialog State
  showWalletDialog = false;
  walletDialogReadOnly = false;
  walletRecordViewId: string | null = null;
  walletAccounts: WalletAccount[] = [];
  walletCategories: WalletCategory[] = [];
  walletCategoriesGrouped: { label: string; items: WalletCategory[] }[] = [];
  selectedWalletAccount: WalletAccount | null = null;
  selectedWalletCategory: WalletCategory | null = null;
  sendingToWallet = false;
  savingWalletRecord = false;
  walletAmount: number | null = null;
  walletDate: string | null = null;
  walletNote: string | null = null;
  walletCounterParty: string | null = null;
  private walletEditSnapshot: {
    amount: number | null;
    date: string | null;
    note: string | null;
    counterParty: string | null;
    account: WalletAccount | null;
    category: WalletCategory | null;
  } | null = null;

  private buildCategoryGroups(categories: WalletCategory[]) {
    const groups = new Map<string, WalletCategory[]>();
    for (const cat of categories) {
      const groupName = cat.envelope?.groupName || cat.groupName || 'Other';
      if (!groups.has(groupName)) groups.set(groupName, []);
      groups.get(groupName)!.push(cat);
    }
    this.walletCategoriesGrouped = Array.from(groups.entries())
      .map(([label, items]) => ({ label, items }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  private loadWalletAccountsAndCategories(onAccounts: (accounts: WalletAccount[]) => void, onCategories: (categories: WalletCategory[]) => void) {
    this.walletService.getAccounts().subscribe({
      next: onAccounts,
      error: (err) => console.error('Failed to fetch accounts', err),
    });
    this.walletService.getCategories().subscribe({
      next: (categories) => {
        this.walletCategories = categories;
        this.buildCategoryGroups(categories);
        onCategories(categories);
      },
      error: (err) => console.error('Failed to fetch categories', err),
    });
  }

  openWalletDialog() {
    this.walletDialogReadOnly = false;
    this.walletRecordViewId = null;
    this.showWalletDialog = true;
    this.walletAmount = null;
    this.walletDate = null;
    this.walletNote = null;
    this.walletCounterParty = null;
    this.selectedWalletAccount = null;
    this.selectedWalletCategory = null;

    this.loadWalletAccountsAndCategories(
      (accounts) => {
        this.walletAccounts = accounts;
      },
      (categories) => {
        if (this.selectedExecution?.ocrProvider === OcrProvider.GeminiToWallet && this.selectedExecution.ocrData) {
          try {
            const payload = JSON.parse(this.selectedExecution.ocrData) as WalletRecordPayload[];
            if (payload.length > 0) {
              const record = payload[0];
              this.walletAmount = record.amount.value;
              this.walletDate = record.recordDate ? record.recordDate.substring(0, 16) : null;
              this.walletNote = record.note;
              this.walletCounterParty = record.counterParty ?? null;
              if (record.categoryId) {
                this.selectedWalletCategory = categories.find((c) => c.id === record.categoryId) ?? null;
              }
            }
          } catch {
            // ocrData not parseable as WalletRecordPayload, leave fields blank
          }
        }
      },
    );
  }

  openWalletRecordView() {
    const record = this.selectedFile?.walletRecord;
    if (!record) return;

    this.walletDialogReadOnly = true;
    this.walletRecordViewId = record.id;
    this.walletAmount = Math.abs(record.amount);
    this.walletDate = record.recordDate ? record.recordDate.substring(0, 16) : null;
    this.walletNote = record.note;
    this.walletCounterParty = record.counterParty ?? null;
    this.selectedWalletAccount = null;
    this.selectedWalletCategory = null;
    this.showWalletDialog = true;

    this.loadWalletAccountsAndCategories(
      (accounts) => {
        this.walletAccounts = accounts;
        this.selectedWalletAccount = accounts.find((a) => a.id === record.accountId) ?? null;
      },
      (categories) => {
        this.selectedWalletCategory = categories.find((c) => c.id === record.categoryId) ?? null;
      },
    );
  }

  switchToEditMode() {
    this.walletEditSnapshot = {
      amount: this.walletAmount,
      date: this.walletDate,
      note: this.walletNote,
      counterParty: this.walletCounterParty,
      account: this.selectedWalletAccount,
      category: this.selectedWalletCategory,
    };
    this.walletDialogReadOnly = false;
  }

  cancelEditWallet() {
    if (this.walletEditSnapshot) {
      this.walletAmount = this.walletEditSnapshot.amount;
      this.walletDate = this.walletEditSnapshot.date;
      this.walletNote = this.walletEditSnapshot.note;
      this.walletCounterParty = this.walletEditSnapshot.counterParty;
      this.selectedWalletAccount = this.walletEditSnapshot.account;
      this.selectedWalletCategory = this.walletEditSnapshot.category;
      this.walletEditSnapshot = null;
    }
    this.walletDialogReadOnly = true;
  }

  saveWalletRecord() {
    if (!this.walletRecordViewId || !this.selectedFile?.id) return;

    if (!this.selectedWalletAccount || !this.selectedWalletCategory) {
      this.messageService.add({ severity: 'warn', summary: 'Warning', detail: 'Please select an account and a category.' });
      return;
    }
    if (this.walletAmount === null || !this.walletDate || !this.walletNote) {
      this.messageService.add({ severity: 'warn', summary: 'Warning', detail: 'Please fill in amount, date and note.' });
      return;
    }

    const amount = -Math.abs(this.walletAmount);
    const recordDate = this.walletDate.length === 16 ? this.walletDate + ':00Z' : this.walletDate;
    const note = this.walletNote;
    const counterParty = this.walletCounterParty || undefined;

    this.savingWalletRecord = true;
    this.walletService
      .updateRecord(
        this.walletRecordViewId,
        this.selectedFile.id,
        this.selectedWalletAccount.id,
        this.selectedWalletCategory.id,
        note,
        amount,
        recordDate,
        counterParty,
      )
      .subscribe({
        next: () => {
          this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Wallet record updated.' });
          this.selectedFile!.walletRecord = {
            id: this.walletRecordViewId!,
            accountId: this.selectedWalletAccount!.id,
            categoryId: this.selectedWalletCategory!.id,
            amount,
            counterParty,
            note,
            recordDate,
          };
          this.walletEditSnapshot = null;
          this.savingWalletRecord = false;
          this.walletDialogReadOnly = true;
        },
        error: (err) => {
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to update Wallet record.' });
          console.error(err);
          this.savingWalletRecord = false;
        },
      });
  }

  sendToWallet() {
    const isGeminiToWallet = this.selectedExecution?.ocrProvider === OcrProvider.GeminiToWallet;

    if (!this.selectedWalletAccount || !this.selectedWalletCategory) {
      this.messageService.add({ severity: 'warn', summary: 'Warning', detail: 'Please select an account and a category.' });
      return;
    }

    let note: string;
    let amount: number;
    let recordDate: string;
    let counterParty: string | undefined;

    if (isGeminiToWallet) {
      if (this.walletAmount === null || !this.walletDate || !this.walletNote) {
        this.messageService.add({ severity: 'warn', summary: 'Warning', detail: 'Please fill in amount, date and note.' });
        return;
      }
      note = this.walletNote;
      amount = -Math.abs(this.walletAmount);
      recordDate = this.walletDate.length === 16 ? this.walletDate + ':00Z' : this.walletDate;
      counterParty = this.walletCounterParty || undefined;
    } else {
      if (!this.selectedExecution?.ocrData) {
        this.messageService.add({ severity: 'warn', summary: 'Warning', detail: 'No OCR data available.' });
        return;
      }
      const ocrData = this.selectedExecution.ocrData;
      const parsed = this.ocrOutputParser.parse(ocrData, this.selectedExecution.ocrProvider);
      note = parsed && parsed.markdown ? parsed.markdown : ocrData;
      amount = -0.01;
      recordDate = new Date().toISOString().split('.')[0] + 'Z';
    }

    this.sendingToWallet = true;
    this.walletService
      .createRecord(this.selectedFile!.id, this.selectedWalletAccount.id, this.selectedWalletCategory.id, note, amount, recordDate, counterParty)
      .subscribe({
        next: (res) => {
          this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Sent to Wallet successfully.' });

          if (res.results && res.results.length > 0 && res.results[0].id) {
            this.selectedFile!.walletRecordId = res.results[0].id;
            this.selectedFile!.walletRecord = {
              id: res.results[0].id,
              accountId: this.selectedWalletAccount!.id,
              categoryId: this.selectedWalletCategory!.id,
              amount,
              counterParty: counterParty || undefined,
              note,
              recordDate,
            };
          }

          this.showWalletDialog = false;
          this.sendingToWallet = false;
          this.selectedWalletAccount = null;
          this.selectedWalletCategory = null;
          this.walletAmount = null;
          this.walletDate = null;
          this.walletNote = null;
          this.walletCounterParty = null;
        },
        error: (err) => {
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to send to Wallet.' });
          console.error(err);
          this.sendingToWallet = false;
        },
      });
  }

  onImageLoad() {
    this.imageLoading.set(false);
  }

  ngOnInit() {
    setTimeout(() => {
      this.fetchJobsWithPagination();
    });
    this.startPolling();
  }

  ngOnDestroy() {
    this.stopPolling();
    this.stopDetailPolling();
  }

  fetchJobsWithPagination(showLoading = true) {
    const page = Math.floor(this.first / this.rows) + 1;
    this.ocrJobService.fetchJobs(
      showLoading,
      page,
      this.rows,
      this.filterStatus || undefined,
      this.searchQuery || undefined,
      this.sortField,
      this.sortOrderDir,
    );
  }

  onPageChange(event: { first?: number; rows?: number }) {
    this.first = event.first ?? 0;
    this.rows = event.rows ?? 20;
    this.fetchJobsWithPagination();
  }

  onSortOrderChange(value: 'latest' | 'oldest' | null) {
    this.sortOrder = value;
    if (value === 'latest') {
      this.sortField = 'createdAt';
      this.sortOrderDir = SortOrder.DESC;
    } else if (value === 'oldest') {
      this.sortField = 'createdAt';
      this.sortOrderDir = SortOrder.ASC;
    }
    this.first = 0;
    this.fetchJobsWithPagination();
  }

  onFilterStatusChange(value: OcrJobStatus | null) {
    this.filterStatus = value;
    this.first = 0;
    this.fetchJobsWithPagination();
  }

  onSearchChange(value: string) {
    this.searchQuery = value;
    this.first = 0;
    this.fetchJobsWithPagination();
  }

  onTableSort(event: { field: string; order: number }) {
    this.sortField = event.field as 'id' | 'name' | 'createdAt' | 'status' | 'filesCount';
    this.sortOrderDir = event.order === 1 ? SortOrder.ASC : SortOrder.DESC;
    this.sortOrder = this.sortField === 'createdAt' ? (this.sortOrderDir === SortOrder.DESC ? 'latest' : 'oldest') : null;
    this.first = 0;
    this.fetchJobsWithPagination();
  }

  constructor() {
    effect(() => {
      const jobs = this.ocrJobService.jobs();
      if (this.selectedJob) {
        const updated = jobs.find((j: OcrJob) => j.id === this.selectedJob?.id);
        if (updated) {
          this.selectedJob = updated;
          if (this._selectedFile) {
            const updatedFile = updated.files?.find((f: OcrFile) => f.id === this._selectedFile?.id);
            if (updatedFile) {
              const wasOnLatest = this.selectedExecution?.id === this.getLatestExecution(this._selectedFile)?.id;
              const hasFilenameChanged = this._selectedFile?.filename !== updatedFile.filename;
              this._selectedFile = updatedFile;
              if (hasFilenameChanged || !this.safeUrl) {
                this.safeUrl = this.getSafeUrl(updatedFile.filename);
              }

              if (this.selectedExecution) {
                const updatedExecution = updatedFile.executions?.find((e: OcrExecution) => e.id === this.selectedExecution?.id);
                if (updatedExecution) {
                  this.selectedExecution = updatedExecution;
                } else if (wasOnLatest) {
                  this.selectedExecution = this.getLatestExecution(updatedFile) || null;
                }
              } else {
                this.selectedExecution = this.getLatestExecution(updatedFile) || null;
              }
            }
          }
        }
      }
    });
  }

  private startPolling() {
    if (this.pollingSubscription) return;
    this.pollingSubscription = interval(3000).subscribe(() => {
      const needsPolling = this.ocrJobService.jobs().some((j: OcrJob) => j.status === OcrJobStatus.Pending || j.status === OcrJobStatus.Processing);

      if (needsPolling) {
        this.fetchJobsWithPagination(false);
      }
    });
  }

  private stopPolling() {
    this.pollingSubscription?.unsubscribe();
    this.pollingSubscription = undefined;
  }

  private startDetailPolling() {
    this.stopDetailPolling();
    this.detailPollingSubscription = interval(5000).subscribe(() => {
      if (!this._showDetail) {
        this.stopDetailPolling();
        return;
      }
      const latest = this.getLatestExecution(this._selectedFile);
      if (latest?.status === OcrExecutionStatus.Completed || latest?.status === OcrExecutionStatus.Failed) {
        this.stopDetailPolling();
        return;
      }
      this.fetchJobsWithPagination(false);
    });
  }

  private stopDetailPolling() {
    this.detailPollingSubscription?.unsubscribe();
    this.detailPollingSubscription = undefined;
  }

  viewDetail(job: OcrJob) {
    this.selectedJob = job;
    this.showDetail = true;
    if (job.files && job.files.length > 0) {
      this.selectedFile = job.files[0];
    }
  }

  async copyToClipboard() {
    if (!this.selectedExecution?.ocrData) return;
    const ocrData = this.selectedExecution.ocrData;
    const parsed = this.ocrOutputParser.parse(ocrData, this.selectedExecution.ocrProvider);
    const contentToCopy = parsed && parsed.markdown ? parsed.markdown : ocrData;

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(contentToCopy);
      } else {
        const el = document.createElement('textarea');
        el.value = contentToCopy;
        el.setAttribute('readonly', '');
        el.style.position = 'absolute';
        el.style.left = '-9999px';
        document.body.appendChild(el);
        el.select();
        const successful = document.execCommand('copy');
        document.body.removeChild(el);
        if (!successful) throw new Error('execCommand copy failed');
      }

      this.messageService.add({
        severity: 'success',
        summary: this.translocoService.translate('ocrJobs.detail.copied'),
        detail: this.translocoService.translate('ocrJobs.detail.copySuccess'),
      });
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Failed to copy to clipboard',
      });
    }
  }

  private recursiveExtractText(node: Node, isInCell = false): string {
    let text = '';
    const children = Array.from(node.childNodes);

    for (const child of children) {
      if (child.nodeType === Node.TEXT_NODE) {
        text += child.textContent || '';
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const el = child as HTMLElement;
        const tagName = el.tagName.toLowerCase();

        // Detect if we are entering a table cell
        const isNewCell = ['td', 'th'].includes(tagName);

        // Process children with the current or updated context
        const childText = this.recursiveExtractText(el, isInCell || isNewCell);

        // Apply formatting based on tag
        if (tagName === 'br') {
          text += childText + (isInCell ? ' ' : '\n');
        } else if (['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) {
          // Paragraphs and headers get a double newline for visual spacing (WYSIWYG)
          // unless we are inside a table cell, in which case we just add a space
          text += childText + (isInCell ? ' ' : '\n\n');
        } else if (['div', 'tr', 'li'].includes(tagName)) {
          // Other block/structured elements get a single newline
          // unless we are inside a table cell (div inside td)
          text += childText + (isInCell ? ' ' : '\n');
        } else if (isNewCell) {
          // At the end of a cell, always add exactly one tab
          text += childText + '\t';
        } else {
          text += childText;
        }
      }
    }

    // Final cleanup for the top-level call (where isInCell is false)
    if (!isInCell) {
      return text.replace(/\n{3,}/g, '\n\n');
    }
    return text;
  }

  async copyAsPlainText() {
    if (!this.selectedExecution?.ocrData) return;
    const ocrData = this.selectedExecution.ocrData;
    const parsed = this.ocrOutputParser.parse(ocrData, this.selectedExecution.ocrProvider);
    const markdown = parsed && parsed.markdown ? parsed.markdown : ocrData;

    try {
      // Configuration for marked
      const parseOptions = { gfm: true, breaks: true };

      // Convert markdown to HTML
      const html = (await marked.parse(markdown, parseOptions)) as string;

      // Create a temporary container for structural parsing
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = html;

      // Extract text using our recursive walker that understands line breaks and tables
      const plainText = this.recursiveExtractText(tempDiv, false);

      const finalContent = plainText.trim();
      if (!finalContent) {
        throw new Error('Final content is empty');
      }

      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(finalContent);
      } else {
        const el = document.createElement('textarea');
        el.value = finalContent;
        el.setAttribute('readonly', '');
        el.style.position = 'absolute';
        el.style.left = '-9999px';
        document.body.appendChild(el);
        el.select();
        const successful = document.execCommand('copy');
        document.body.removeChild(el);
        if (!successful) throw new Error('execCommand copy failed');
      }

      this.messageService.add({
        severity: 'success',
        summary: this.translocoService.translate('ocrJobs.detail.copied'),
        detail: this.translocoService.translate('ocrJobs.detail.copyPlainTextSuccess'),
      });
    } catch (err) {
      console.error('Failed to convert to plain text:', err);
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Failed to copy as plain text',
      });
    }
  }

  downloadMarkdown() {
    if (!this.selectedExecution?.ocrData || !this.selectedFile) return;
    const ocrData = this.selectedExecution.ocrData;
    const parsed = this.ocrOutputParser.parse(ocrData, this.selectedExecution.ocrProvider);
    const contentToDownload = parsed && parsed.markdown ? parsed.markdown : ocrData;

    const blob = new Blob([contentToDownload], { type: 'text/markdown' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.selectedFile.originalName}.md`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    this.messageService.add({
      severity: 'success',
      summary: this.translocoService.translate('ocrJobs.detail.downloaded'),
      detail: this.translocoService.translate('ocrJobs.detail.downloadSuccess'),
    });
  }

  onUploaded() {
    this.showUploadDialog = false;
    this.fetchJobsWithPagination();
  }

  refreshSelectedJob() {
    this.fetchJobsWithPagination(false);
  }

  private readonly statusSeverity: Record<string, 'success' | 'info' | 'warn' | 'danger' | 'secondary'> = {
    pending: 'secondary',
    processing: 'info',
    running: 'info',
    completed: 'success',
    failed: 'danger',
  };

  getStatusSeverity(status: string) {
    return this.statusSeverity[status] ?? 'secondary';
  }

  private ext(filename: string): string {
    return '.' + (filename.split('.').pop()?.toLowerCase() || '');
  }

  isFilePdf(filename: string): boolean {
    return this.ext(filename) === FileExtension.Pdf;
  }

  isFileImage(filename: string): boolean {
    return ImageExtensions.includes(this.ext(filename) as FileExtension);
  }

  getFileIcon(filename: string): string {
    if (this.isFilePdf(filename)) return 'pi pi-file-pdf text-red-400';
    if (this.isFileImage(filename)) return 'pi pi-image text-emerald-400';
    return 'pi pi-file text-surface-400';
  }

  getSafeUrl(filename: string): SafeResourceUrl {
    return this.sanitizer.bypassSecurityTrustResourceUrl(this.ocrJobService.getFileUrl(filename));
  }

  getLatestExecution(file: OcrFile | null): OcrExecution | undefined {
    if (!file?.executions || file.executions.length === 0) return undefined;
    return [...file.executions].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
  }

  reprocess(file: OcrFile, provider: OcrProvider) {
    this.ocrJobService.reprocessFile(file.id, provider).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'info',
          summary: this.translocoService.translate('ocrJobs.card.retrying'),
          detail: this.translocoService.translate('ocrJobs.card.retryQueued'),
        });
        this.fetchJobsWithPagination();
        this.startDetailPolling();
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to re-queue OCR job.' });
        console.error(err);
      },
    });
  }

  deleteJob(event: Event, job: OcrJob) {
    event.stopPropagation();
    this.confirmationService.confirm({
      message: this.translocoService.translate('ocrJobs.delete.confirmation'),
      header: this.translocoService.translate('ocrJobs.delete.title'),
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: this.translocoService.translate('common.delete'),
      rejectLabel: this.translocoService.translate('common.cancel'),
      acceptButtonStyleClass: 'p-button-danger',
      rejectButtonStyleClass: 'p-button-text p-button-secondary',
      accept: () => {
        this.ocrJobService.deleteJob(job.id).subscribe({
          next: () => {
            this.messageService.add({
              severity: 'success',
              summary: this.translocoService.translate('ocrJobs.delete.success'),
            });
            this.fetchJobsWithPagination();
            if (this.selectedJob?.id === job.id) {
              this.showDetail = false;
            }
          },
          error: (err) => {
            this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to delete job.' });
            console.error(err);
          },
        });
      },
    });
  }
}
