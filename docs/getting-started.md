---
layout: default
title: Getting Started
nav_order: 2
---

# Getting Started

## Prerequisites

- Node.js 18 or higher
- npm or yarn
- Redis (for background job processing)
- Docker & Docker Compose (optional, for containerized deployment)

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/iursevla/open-receipt-ocr.git
cd open-receipt-ocr
```

### 2. Install Dependencies

```bash
npm install
```

This installs dependencies for the entire monorepo including:
- `server/` - NestJS backend
- `client/` - Angular frontend
- `packages/` - Shared types and utilities

### 3. Configure Environment Variables

Copy the example configuration:

```bash
cp server/.env.example server/.env
```

Open `server/.env` and add your API keys for the OCR providers you want to use. At minimum, you need to set the `NODE_ENV`:

```env
NODE_ENV=development

# Add API keys for providers you'll use
GEMINI_API_KEY=your_gemini_key
OPENAI_API_KEY=your_openai_key
TAB_SCANNER_API_KEY=your_tabscanner_key
```

See [Configuration Guide](./configuration.md) for detailed instructions on each provider.

### 4. Start Redis

The application requires Redis for background job processing. Start it locally:

```bash
redis-server
```

Or using Docker:

```bash
docker run -d -p 6379:6379 redis:latest
```

### 5. Run the Application

Start both the frontend and backend in development mode:

```bash
npm run dev
```

This will:
- Start the Angular frontend on `http://localhost:4200`
- Start the NestJS backend on `http://localhost:3000`
- Watch for changes and auto-reload

### 6. Access the Application

Open your browser and navigate to:

```
http://localhost:4200
```

You should see the Open Receipt OCR interface. Try uploading a receipt image!

## Basic Workflow

1. **Upload a Receipt**: Click the upload button or drag-and-drop an image
2. **Select OCR Provider**: Choose from available providers (based on your configuration)
3. **View Results**: Once processing completes, view the extracted text
4. **Export**: Download or copy the OCR results

### Wallet Integration Workflow (Gemini → Wallet)

If you have configured `USE_WALLET_OCR_PROCESSOR_PROVIDER=true` and `BUDGET_BAKERS_TOKEN`, a dedicated **Gemini → Wallet** provider becomes available:

1. **Upload**: Select file(s) — no account or category selection needed
2. **AI Extraction**: Gemini reads the receipt and extracts amount, date, line items, and merchant; it suggests a category based on your 20 most-recent Wallet transactions
3. **Review**: Click **Send To Wallet** to open a pre-filled form — verify or adjust any field
4. **Confirm**: Click **Send** — the expense is created in Wallet by BudgetBakers
5. **View / Edit**: The button becomes **Saved in Wallet**; click it to view the Wallet Record ID or edit the record

See [Configuration Guide](./configuration.md#wallet-by-budgetbakers-integration) for setup details.

## Using the Headless API

You can also use the platform programmatically via REST API:

```bash
# Upload a file for OCR
curl -X POST http://localhost:3000/ocr-jobs/upload \
  -F "file=@receipt.jpg" \
  -F "ocrProvider_0=mistral" \
  -F "jobName=My Receipt"

# Response: { "id": 123 }

# Check job status
curl http://localhost:3000/ocr-jobs/123

# Response includes: id, status, files with OCR results
```

See [API Documentation](./api.md) for full API reference.

## Troubleshooting

### Port Already in Use

If you get a port already in use error:

```bash
# Change the frontend port
npm run dev -- --port 4300

# Or check what's using the port and kill it
lsof -i :4200  # Find process using port 4200
kill -9 <PID>
```

### Redis Connection Failed

Ensure Redis is running:

```bash
redis-cli ping
# Should return: PONG
```

If using Docker:

```bash
docker ps | grep redis
# Should show the redis container running
```

### Module Not Found Errors

Reinstall dependencies:

```bash
rm -rf node_modules
npm install
```

### OCR Provider Not Available

Make sure you've:
1. Set the required API key in `server/.env`
2. Restarted the application after adding the key
3. Checked that the provider is properly configured

## Next Steps

- Read [Configuration Guide](./configuration.md) to set up OCR providers
- Check [Development Guide](./development.md) if you plan to contribute
- Review [Extending Guide](./extending.md) to add custom providers
- Deploy with [Docker Compose](./docker.md)
