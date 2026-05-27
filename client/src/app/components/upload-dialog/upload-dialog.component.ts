import { Component, EventEmitter, inject, Input, Output, signal, computed, ViewChild, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OcrJobService, OCR_PROVIDER_ICONS, LOCAL_PROVIDERS } from '@services/ocr-job.service';

import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { ProgressBarModule } from 'primeng/progressbar';

import { OcrProvider } from '@open-receipt-ocr/types';
import { SelectModule } from 'primeng/select';
import { FormsModule } from '@angular/forms';
import { FileUpload, FileUploadModule } from 'primeng/fileupload';
import { InputTextModule } from 'primeng/inputtext';
import { TooltipModule } from 'primeng/tooltip';

import { ConfigService } from '@services/config.service';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { MimeType } from '@open-receipt-ocr/types';
import { ImageCropDialogComponent } from '@components/image-crop-dialog/image-crop-dialog.component';

import { ImageTransform, CropperPosition } from 'ngx-image-cropper';

interface FileWithProvider {
  file: File;
  ocrProvider?: OcrProvider;
  croppedFile?: File;
  transform?: ImageTransform;
  cropper?: CropperPosition;
}

import { WalletService, WalletAccount, WalletCategory } from '@services/wallet.service';

@Component({
  selector: 'app-upload-dialog',
  standalone: true,
  imports: [
    CommonModule,
    DialogModule,
    ButtonModule,
    MessageModule,
    ProgressBarModule,
    SelectModule,
    FormsModule,
    TranslocoModule,
    FileUploadModule,
    ToastModule,
    InputTextModule,
    TooltipModule,
    ImageCropDialogComponent,
  ],
  templateUrl: './upload-dialog.component.html',
})
export class UploadDialogComponent implements OnInit {
  @ViewChild('fileUpload') fileUpload!: FileUpload;

  private ocrJobService = inject(OcrJobService);
  public configService = inject(ConfigService);
  private translocoService = inject(TranslocoService);
  private messageService = inject(MessageService);
  private walletService = inject(WalletService);

  @Input() set visible(val: boolean) {
    this._visible = val;
    if (val) {
      this.reset();
      this.loadWalletConfig();
    }
  }
  get visible() {
    return this._visible;
  }
  private _visible = false;

  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() uploaded = new EventEmitter<void>();

  filesWithProviders = signal<FileWithProvider[]>([]);
  jobName = signal<string>('');
  uploading = signal(false);
  message = signal<string | null>(null);
  isError = signal(false);
  cropTarget = signal<FileWithProvider | null>(null);

  useWalletOcrProvider = signal(false);
  accounts = signal<WalletAccount[]>([]);
  categories = signal<WalletCategory[]>([]);
  selectedAccountId = signal<string | null>(null);
  selectedCategoryId = signal<string | null>(null);
  walletConfigMissing = computed(() => !this.selectedAccountId() || !this.selectedCategoryId());

  ngOnInit() {
    this.loadWalletConfig();
  }

  private loadWalletConfig() {
    this.walletService.getConfig().subscribe((config) => {
      this.useWalletOcrProvider.set(config.useWalletOcrProcessorProvider);
      if (config.useWalletOcrProcessorProvider) {
        // Priority: locally stored (from settings dialog) > server env var defaults
        const storedAccountId = this.configService.walletAccountId();
        const storedCategoryId = this.configService.walletCategoryId();
        this.selectedAccountId.set(storedAccountId || config.defaultAccountId || null);
        this.selectedCategoryId.set(storedCategoryId || config.defaultCategoryId || null);

        this.walletService.getAccounts().subscribe((accounts) => this.accounts.set(accounts));
        this.walletService.getCategories().subscribe((categories) => this.categories.set(categories));
      }
    });
  }

  isImage(file: File): boolean {
    return file.type.startsWith('image/');
  }

  openCrop(item: FileWithProvider) {
    this.cropTarget.set(item);
  }

  closeCrop() {
    this.cropTarget.set(null);
  }

  applyCrop(event: { file: File; transform: ImageTransform; cropper: CropperPosition }) {
    const target = this.cropTarget();
    if (!target) return;
    this.filesWithProviders.update((items) =>
      items.map((i) => (i === target ? { ...i, croppedFile: event.file, transform: event.transform, cropper: event.cropper } : i)),
    );
    this.cropTarget.set(null);
  }

  resetCrop(item: FileWithProvider) {
    this.filesWithProviders.update((items) =>
      items.map((i) => (i === item ? { ...i, croppedFile: undefined, transform: undefined, cropper: undefined } : i)),
    );
  }

  get ocrOptionGroups() {
    const local: { label: string; value: OcrProvider; icon: string }[] = [];
    const online: { label: string; value: OcrProvider; icon: string }[] = [];
    for (const p of Object.values(OcrProvider)) {
      const opt = { label: this.translocoService.translate(`config.providers.${p}`), value: p, icon: OCR_PROVIDER_ICONS[p] };
      (LOCAL_PROVIDERS.has(p) ? local : online).push(opt);
    }
    return [
      { label: this.translocoService.translate('config.groups.local'), items: local },
      { label: this.translocoService.translate('config.groups.online'), items: online },
    ];
  }

  reset() {
    this.filesWithProviders.set([]);
    this.jobName.set('');
    this.message.set(null);
    this.isError.set(false);
    this.uploading.set(false);
    this.fileUpload?.clear();
  }

  readonly ALLOWED_TYPES = [MimeType.Jpeg, MimeType.Png];

  get acceptTypes() {
    return this.ALLOWED_TYPES.join(',');
  }

  onSelect(event: { currentFiles?: File[]; files?: File[] }) {
    const newFiles: File[] = event.currentFiles || event.files || [];
    const defaultProvider = this.configService.defaultOcrProvider();

    const current = this.filesWithProviders();
    const updated = [...current];
    let skipped = 0;

    newFiles.forEach((f) => {
      if (!this.ALLOWED_TYPES.includes(f.type as MimeType)) {
        skipped++;
        return;
      }

      if (!updated.some((item) => item.file.name === f.name && item.file.size === f.size)) {
        updated.push({
          file: f,
          ocrProvider: this.useWalletOcrProvider() ? OcrProvider.GeminiToWallet : (defaultProvider ?? undefined),
        });
      }
    });

    if (skipped > 0) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Unsupported files',
        detail: `${skipped} file(s) were skipped (only PDF, JPG, PNG allowed).`,
      });
    }

    this.filesWithProviders.set(updated);

    // Auto-open crop dialog if only one image was selected (e.g. from camera)
    if (newFiles.length === 1 && this.isImage(newFiles[0])) {
      const addedItem = updated.find((i) => i.file === newFiles[0]);
      if (addedItem) {
        this.openCrop(addedItem);
      }
    }

    // Clear the PrimeNG internal file list because we manage our own in filesWithProviders
    this.fileUpload.clear();
  }

  setProvider(item: FileWithProvider, provider: OcrProvider) {
    this.filesWithProviders.update((items) => items.map((i) => (i === item ? { ...i, ocrProvider: provider } : i)));
  }

  removeFile(item: FileWithProvider) {
    this.filesWithProviders.set(this.filesWithProviders().filter((f) => f !== item));
    this.fileUpload.files = this.fileUpload.files.filter((f) => f !== item.file);
  }

  allProvidersSelected(): boolean {
    const items = this.filesWithProviders();
    return items.length > 0 && items.every((i) => !!i.ocrProvider);
  }

  doUpload() {
    const items = this.filesWithProviders();
    if (items.length === 0 || items.some((i) => !i.ocrProvider)) return;

    this.uploading.set(true);
    this.message.set(null);

    const files = items.map((i) => i.croppedFile || i.file);
    const providers = items.map((i) => i.ocrProvider as OcrProvider);

    if (this.useWalletOcrProvider() && (!this.selectedAccountId() || !this.selectedCategoryId())) {
      this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Account and Category must be selected.' });
      this.uploading.set(false);
      return;
    }

    this.ocrJobService
      .uploadJob(files, providers, this.jobName(), this.selectedAccountId() || undefined, this.selectedCategoryId() || undefined)
      .subscribe({
        next: () => {
          this.uploading.set(false);
          this.message.set('upload.uploadSuccess');
          this.isError.set(false);
          this.filesWithProviders.set([]);
          this.uploaded.emit();
          setTimeout(() => this.close(), 1000);
        },
        error: (err) => {
          this.uploading.set(false);
          this.message.set('upload.uploadFailed');
          this.isError.set(true);
          console.error(err);
        },
      });
  }

  close() {
    this.reset();
    this.visibleChange.emit(false);
  }

  formatSize(bytes: number) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}
