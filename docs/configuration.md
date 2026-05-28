---
layout: default
title: Configuration
nav_order: 3
---

# Configuration Guide

This guide covers configuring OCR providers, storage backends, and secret management.

## OCR Providers

Configure OCR providers by setting environment variables in `server/.env`.

### Local Providers (No API Keys)

#### PaddleOCR Local

High-quality OCR engine running locally on your CPU/GPU. No API calls required.

```env
PADDLE_OCR_LOCAL_ENABLED=true
```

**Note:** First use will download ~300MB of model files. These are cached for subsequent runs.

#### Tesseract.js

Classic open-source OCR engine running in WebAssembly. Good for multiple languages.

```env
# Add language codes separated by +
TESSERACT_LANGUAGE=eng+por+fra
```

Common language codes: `eng` (English), `por` (Portuguese), `fra` (French), `deu` (German), `spa` (Spanish)

#### llama.cpp

Run advanced vision models locally for superior accuracy. Requires running `llama-server` separately.

```env
# llama-server must be running on this URL
LLAMA_CPP_BASE_URL=http://localhost:8080/v1
```

Start the llama server:

```bash
llama-server --mmproj <clip-model-path> -m <vision-model-path> --port 8080
```

Example with LLaVA:

```bash
llama-server --mmproj llava-1.5-7b-Q4_K_M.gguf -m llava-v1.5-7b-Q4_K_M.gguf --port 8080
```

### Cloud Providers (API Keys Required)

#### TabScanner

Highly optimized for retail receipts and invoices. Recommended for receipt OCR.

```env
TAB_SCANNER_API_KEY=your_api_key_here
```

Get API key: [https://tabscanner.com](https://tabscanner.com)

#### Google Gemini

Advanced vision capabilities using Gemini 1.5 or 2.0 models.

```env
GEMINI_API_KEY=your_api_key_here
```

Get API key: [Google AI Studio](https://aistudio.google.com)

#### OpenAI

Reliable GPT-4o vision capabilities for document analysis.

```env
OPENAI_API_KEY=your_api_key_here
```

Get API key: [OpenAI Platform](https://platform.openai.com)

#### Mistral AI

Native document understanding via Mistral's vision models.

```env
MISTRAL_API_KEY=your_api_key_here
```

Get API key: [Mistral Console](https://console.mistral.ai)

#### xAI Grok

Specialized vision-language processing via Grok-2.

```env
XAI_API_KEY=your_api_key_here
```

Get API key: [xAI Platform](https://platform.x.ai)

#### AWS Textract

Enterprise-grade document extraction from AWS.

```env
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-1
```

#### PaddleOCR API

Hosted version of PaddleOCR for cloud-based processing.

```env
PADDLE_OCR_ENDPOINT=your_endpoint_url
PADDLE_OCR_API_KEY=your_api_key
```

## Wallet by BudgetBakers Integration

The **Gemini → Wallet** provider automates the full receipt-to-expense pipeline: Gemini reads the receipt, suggests a category based on your recent transactions, and sends the record directly to your Wallet account. Users review and confirm the extracted data in a pre-filled dialog before anything is saved.

### Required Variables

```env
# Enable the Gemini → Wallet OCR provider in the upload dialog
USE_WALLET_OCR_PROCESSOR_PROVIDER=true

# BudgetBakers API bearer token
BUDGET_BAKERS_TOKEN=your_budgetbakers_token

# Gemini (also used by the standard Gemini provider)
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-2.5-flash   # optional, this is the default
```

> [!TIP]
> Your BudgetBakers token is available at **Wallet web app → Settings → API**.
> Available accounts and categories can be browsed via `GET /wallet/accounts` and `GET /wallet/categories` (see [API Reference](./api.md)).

### How the Flow Works

1. **Upload** — user uploads a receipt and selects the *Gemini → Wallet* provider. No account or category selection is needed at this stage.
2. **AI Extraction** — the server calls the BudgetBakers API for the last 20 records to derive your most-used categories, then passes them to Gemini with the receipt image. Gemini returns structured JSON:
   - `amount` — total amount paid
   - `recordDate` — ISO 8601 date from the receipt
   - `note` — line-item summary (one item per line, max 255 chars)
   - `counterParty` — merchant/store name
   - `categoryId` — best-matching category from your recent history
3. **Review** — once OCR is complete, the user clicks *Send To Wallet* and sees a pre-filled form showing all extracted fields plus account/category dropdowns.
4. **Confirm** — clicking *Send* negates the amount (expenses are negative) and calls `POST /wallet/records` to create the record in BudgetBakers.
5. **View / Edit** — the button changes to *Saved in Wallet*. Clicking it reopens the dialog in read-only mode showing the Wallet Record ID. An **Edit** button allows updating category, amount, date, note, or merchant via `PATCH /wallet/records`.

### Caching

To avoid hammering the BudgetBakers API on every upload, the server caches responses:

| Resource | TTL |
|----------|-----|
| Accounts | 1 hour |
| Categories | 1 hour |
| Recent records (for category hints) | 15 minutes |

---

## Storage Providers

Configure where uploaded files are stored.

### Local Storage (Default)

Files stored in `server/uploads/` directory.

```env
STORAGE_PROVIDER=local
```

### OneDrive

Store files in Microsoft OneDrive using Microsoft Graph API.

```env
STORAGE_PROVIDER=onedrive
ONEDRIVE_CLIENT_ID=your_client_id
ONEDRIVE_CLIENT_SECRET=your_client_secret
ONEDRIVE_TENANT_ID=your_tenant_id
ONEDRIVE_FOLDER_ID=your_folder_id
```

**Setup Steps:**

1. Register an application in [Azure Portal](https://portal.azure.com)
2. Create a client secret
3. Grant `Files.ReadWrite` permission to Microsoft Graph API
4. Add the credentials to your `.env`

## Secret Management

Choose how the application retrieves secrets (API keys, etc).

### Environment Variables (Default)

Read secrets directly from `server/.env` file.

```env
SECRET_PROVIDER=env
```

Simple and suitable for development and small deployments.

### Infisical

Enterprise secret management via [Infisical](https://infisical.com/).

```env
SECRET_PROVIDER=infisical
INFISICAL_API_KEY=your_api_key
INFISICAL_PROJECT_SLUG=your_project
INFISICAL_ENVIRONMENT=prod
```

Benefits:
- Centralized secret management
- Audit logs
- Secret rotation
- Team collaboration

## Database Configuration

The application uses SQLite by default, suitable for most use cases.

```env
DATABASE_URL=sqlite:./data/db/ocr.sqlite
```

For production, consider migrating to PostgreSQL. See [Development Guide](./development.md) for TypeORM setup.

## Redis Configuration

Redis is required for background job processing with BullMQ.

```env
REDIS_URL=redis://localhost:6379
```

### Docker

When using Docker Compose, Redis is automatically managed:

```env
REDIS_URL=redis://redis:6379
```

## Application Settings

```env
# Development or production mode
NODE_ENV=development

# Server port
SERVER_PORT=3000

# Frontend URL (for CORS, optional)
CLIENT_URL=http://localhost:4200

# Session secret for secure sessions
SESSION_SECRET=your_random_secret_string_here
```

## Environment File Template

Here's a complete `.env.example`:

```env
# Environment
NODE_ENV=development
SERVER_PORT=3000
SESSION_SECRET=change_me_in_production

# Database
DATABASE_URL=sqlite:./data/db/ocr.sqlite

# Redis (required for background jobs)
REDIS_URL=redis://localhost:6379

# OCR Providers - Local
PADDLE_OCR_LOCAL_ENABLED=false
TESSERACT_LANGUAGE=eng
LLAMA_CPP_BASE_URL=http://localhost:8080/v1

# OCR Providers - Cloud (uncomment to enable)
# GEMINI_API_KEY=
# GEMINI_MODEL=gemini-2.5-flash
# OPENAI_API_KEY=
# MISTRAL_API_KEY=
# XAI_API_KEY=
# TAB_SCANNER_API_KEY=
# AWS_ACCESS_KEY_ID=
# AWS_SECRET_ACCESS_KEY=
# AWS_REGION=

# Wallet by BudgetBakers integration
# USE_WALLET_OCR_PROCESSOR_PROVIDER=false
# BUDGET_BAKERS_TOKEN=

# Storage
STORAGE_PROVIDER=local
# ONEDRIVE_CLIENT_ID=
# ONEDRIVE_CLIENT_SECRET=
# ONEDRIVE_TENANT_ID=
# ONEDRIVE_FOLDER_ID=

# Secrets Management
SECRET_PROVIDER=env
# INFISICAL_API_KEY=
# INFISICAL_PROJECT_SLUG=
# INFISICAL_ENVIRONMENT=
```

## Validation

After setting up your configuration, verify everything is working:

```bash
# Test that the server can read environment variables
npm run dev

# Check that configured providers appear in the UI dropdown
# Visit http://localhost:4200 and upload a test receipt
```

## Troubleshooting

### "Provider not available in UI"

- Verify API key is set in `server/.env`
- Restart the server after adding the key
- Check for typos in the environment variable name

### "Invalid API key" error during OCR

- Verify the API key is correct
- Check that the key has required permissions/scopes
- Some providers have usage limits or geographic restrictions

### Redis connection errors

- Ensure Redis is running: `redis-cli ping` should return `PONG`
- Check `REDIS_URL` is correct
- If using Docker, ensure container is running: `docker ps | grep redis`
