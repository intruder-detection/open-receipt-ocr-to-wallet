export enum AppSecret {
  // ─── App ────────────────────────────────────────────────────────────────────
  Port = 'PORT',
  NodeEnv = 'NODE_ENV',

  // ─── Secret provider ────────────────────────────────────────────────────────
  SecretProvider = 'SECRET_PROVIDER',

  // ─── Database (SQLite) ──────────────────────────────────────────────────────
  DatabasePath = 'DATABASE_PATH',

  // ─── Redis / BullMQ ─────────────────────────────────────────────────────────
  RedisHost = 'REDIS_HOST',
  RedisPort = 'REDIS_PORT',

  // ─── Mistral OCR ─────────────────────────────────────────────────────────────
  MistralApiKey = 'MISTRAL_API_KEY',

  // ─── TabScanner OCR ─────────────────────────────────────────────────────────
  TabScannerApiKey = 'TAB_SCANNER_API_KEY',

  // ─── PaddleOCR (API) ────────────────────────────────────────────────────────
  PaddleOcrApiKey = 'PADDLE_OCR_API_KEY',
  PaddleOcrEndpoint = 'PADDLE_OCR_ENDPOINT',

  // ─── PaddleOCR (Local) ──────────────────────────────────────────────────────
  PaddleOcrLocalEnabled = 'PADDLE_OCR_LOCAL_ENABLED',

  // ─── Gemini ─────────────────────────────────────────────────────────────────
  GeminiApiKey = 'GEMINI_API_KEY',

  // ─── OpenAI ──────────────────────────────────────────────────────────────────
  OpenAiApiKey = 'OPENAI_API_KEY',

  // ─── xAI / Grok ─────────────────────────────────────────────────────────────
  XaiApiKey = 'XAI_API_KEY',

  // ─── Tesseract.js ────────────────────────────────────────────────────────────
  TesseractLanguage = 'TESSERACT_LANGUAGE',

  // ─── llama.cpp ───────────────────────────────────────────────────────────────
  LlamaCppBaseUrl = 'LLAMA_CPP_BASE_URL',
  LlamaCppModel = 'LLAMA_CPP_MODEL',

  // ─── Azure OCR ──────────────────────────────────────────────────────────────
  AzureOcrApiKey = 'AZURE_OCR_API_KEY',
  AzureOcrEndpoint = 'AZURE_OCR_ENDPOINT',

  // ─── AWS Textract ───────────────────────────────────────────────────────────
  AwsAccessKeyId = 'AWS_ACCESS_KEY_ID',
  AwsSecretAccessKey = 'AWS_SECRET_ACCESS_KEY',
  AwsRegion = 'AWS_REGION',

  // ─── Storage ────────────────────────────────────────────────────────────────
  StorageProvider = 'STORAGE_PROVIDER',
  MaxFileSizeBytes = 'MAX_FILE_SIZE_BYTES',
  StoragePartSize = 'STORAGE_PART_SIZE',
  // ─── Storage - Local ────────────────────────────────────────────────────────
  StorageLocalPath = 'STORAGE_LOCAL_PATH',
  // ─── Storage - OneDrive ─────────────────────────────────────────────────────
  OneDriveClientId = 'ONEDRIVE_CLIENT_ID',
  OneDriveClientSecret = 'ONEDRIVE_CLIENT_SECRET',
  OneDriveTenantId = 'ONEDRIVE_TENANT_ID',
  OneDriveRefreshToken = 'ONEDRIVE_REFRESH_TOKEN',
  OneDriveDriveId = 'ONEDRIVE_DRIVE_ID',
  OneDriveFolder = 'ONEDRIVE_FOLDER',

  // ─── Infisical ─────────────────────────────────────────────────────────────
  InfisicalClientId = 'INFISICAL_CLIENT_ID',
  InfisicalClientSecret = 'INFISICAL_CLIENT_SECRET',
  InfisicalProjectId = 'INFISICAL_PROJECT_ID',
  InfisicalEnvironment = 'INFISICAL_ENVIRONMENT',
  InfisicalSiteUrl = 'INFISICAL_SITE_URL',

  // ─── BudgetBakers ─────────────────────────────────────────────────────────────
  BudgetBakersToken = 'BUDGET_BAKERS_TOKEN',
}

/**
 * Sane defaults for core application secrets.
 * These are used by SecretProvider if no value is found in the background store.
 */
export const DefaultAppSecret: Partial<Record<AppSecret, string | number>> = {
  [AppSecret.Port]: 9999,
  [AppSecret.DatabasePath]: 'data/db/ocr.sqlite',
  [AppSecret.StorageProvider]: 'local',
  [AppSecret.StorageLocalPath]: 'data/uploads',
  [AppSecret.RedisHost]: 'localhost',
  [AppSecret.RedisPort]: 6379,
  [AppSecret.StoragePartSize]: 5 * 1024 * 1024,
};
