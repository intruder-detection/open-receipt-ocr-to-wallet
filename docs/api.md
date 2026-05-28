---
layout: default
title: API Reference
nav_order: 4
---

# API Reference

Use the Open Receipt OCR REST API to integrate receipt processing into your applications.

## Base URL

```
http://localhost:3000
```

In production, replace with your deployment URL.

## Authentication

Currently, the API does not require authentication. For production deployments, consider adding API key authentication.

## OCR Jobs

### Upload Files for OCR

Upload one or more files for OCR processing.

**Endpoint:** `POST /ocr-jobs/upload`

**Request:**

Multipart form data with the following fields:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | File | Yes | The image file (JPEG, PNG, WebP, etc.) |
| `ocrProvider_<index>` | String | Yes | OCR provider for the file at `<index>` |
| `jobName` | String | No | Human-readable name for the job |

The `<index>` in `ocrProvider_<index>` corresponds to the position of the file in the multipart request (starting at 0).

**Example:**

```bash
curl -X POST http://localhost:3000/ocr-jobs/upload \
  -F "file=@receipt.jpg" \
  -F "ocrProvider_0=mistral" \
  -F "jobName=Weekly Groceries"
```

**Response:**

```json
{
  "id": 123
}
```

The `id` can be used to check job status and retrieve results.

**Supported Providers:**

- `paddle-ocr-local`
- `tesseract`
- `llama-cpp`
- `gemini`
- `openai`
- `mistral`
- `xai-grok`
- `tab-scanner`
- `aws-textract`
- `paddle-ocr-api`

Provider must be configured and available (see [Configuration Guide](./configuration.md)).

### Get Job Details

Retrieve job status and OCR results.

**Endpoint:** `GET /ocr-jobs/:id`

**Example:**

```bash
curl http://localhost:3000/ocr-jobs/123
```

**Response:**

```json
{
  "id": 123,
  "name": "Weekly Groceries",
  "status": "completed",
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T10:35:00Z",
  "files": [
    {
      "id": 1,
      "originalName": "receipt.jpg",
      "storageKey": "uploads/123/receipt.jpg",
      "executions": [
        {
          "id": 1,
          "status": "completed",
          "ocrProvider": "mistral",
          "ocrData": "{\"markdown\": \"# Receipt\\n\\n...\"}",
          "createdAt": "2024-01-15T10:30:00Z",
          "updatedAt": "2024-01-15T10:35:00Z"
        }
      ]
    }
  ]
}
```

**Job Status Values:**

- `pending` - Waiting to be processed
- `running` - Currently being processed
- `completed` - Processing finished (some files may have failed)
- `failed` - Job failed before processing

**File Execution Status:**

- `pending` - Waiting to be processed
- `running` - Currently being OCR'd
- `completed` - Successfully extracted text
- `failed` - OCR processing failed

### List Jobs

Get all jobs (pagination supported).

**Endpoint:** `GET /ocr-jobs`

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | Number | 1 | Page number |
| `limit` | Number | 20 | Results per page |
| `sort` | String | `createdAt:desc` | Sort field and direction |

**Example:**

```bash
curl "http://localhost:3000/ocr-jobs?page=1&limit=10&sort=createdAt:desc"
```

**Response:**

```json
{
  "data": [
    {
      "id": 123,
      "name": "Weekly Groceries",
      "status": "completed",
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ],
  "pagination": {
    "total": 42,
    "page": 1,
    "limit": 10,
    "pages": 5
  }
}
```

### Delete Job

Remove a job and its associated files.

**Endpoint:** `DELETE /ocr-jobs/:id`

**Example:**

```bash
curl -X DELETE http://localhost:3000/ocr-jobs/123
```

**Response:**

```json
{
  "success": true
}
```

## File Operations

### Get File

Retrieve a specific file from a job.

**Endpoint:** `GET /ocr-jobs/:jobId/files/:fileId`

**Example:**

```bash
curl http://localhost:3000/ocr-jobs/123/files/1
```

**Response:**

Binary file content (original uploaded file).

### Delete File

Remove a specific file from a job.

**Endpoint:** `DELETE /ocr-jobs/:jobId/files/:fileId`

**Example:**

```bash
curl -X DELETE http://localhost:3000/ocr-jobs/123/files/1
```

## Wallet by BudgetBakers

These endpoints proxy requests to the BudgetBakers Wallet API and are only meaningful when `USE_WALLET_OCR_PROCESSOR_PROVIDER=true` and `BUDGET_BAKERS_TOKEN` is configured.

### Get Wallet Configuration

Returns the current Wallet integration settings (feature flag + defaults).

**Endpoint:** `GET /wallet/config`

**Response:**

```json
{
  "useWalletOcrProcessorProvider": true
}
```

### List Wallet Accounts

Returns all accounts from BudgetBakers (cached for 1 hour).

**Endpoint:** `GET /wallet/accounts`

**Response:**

```json
{
  "accounts": [
    { "id": "36f3d28e-ab72-492b-aa8f-14d2d77d00d9", "name": "Genérico" }
  ]
}
```

### List Wallet Categories

Returns all expense categories from BudgetBakers (cached for 1 hour).

**Endpoint:** `GET /wallet/categories`

**Response:**

```json
{
  "categories": [
    {
      "id": "5c5c03e9-000a-8000-8000-000000000000",
      "name": "Restaurants & fast food",
      "envelope": { "groupName": "Food & Drink" }
    }
  ]
}
```

### Create a Wallet Record

Creates a new expense record in BudgetBakers and stores the association in the local database.

**Endpoint:** `POST /wallet/records`

**Request Body:**

```json
{
  "fileId": 12,
  "accountId": "36f3d28e-ab72-492b-aa8f-14d2d77d00d9",
  "categoryId": "5c5c03e9-000a-8000-8000-000000000000",
  "note": "1x Burger (8.50)\n1x Fries (3.84)",
  "amount": -12.34,
  "recordDate": "2025-03-15T13:22:00Z",
  "counterParty": "Downtown Bistro"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `fileId` | Number | Yes | ID of the OCR file to associate this record with |
| `accountId` | String | Yes | BudgetBakers account UUID |
| `categoryId` | String | Yes | BudgetBakers category UUID |
| `note` | String | Yes | Expense description (max 255 chars) |
| `amount` | Number | Yes | Expense amount — **must be negative** for expenses |
| `recordDate` | String | Yes | ISO 8601 datetime of the transaction |
| `counterParty` | String | No | Merchant / store name |

**Response:**

```json
{
  "summary": { "total": 1, "succeeded": 1, "clientErrors": 0, "serverErrors": 0 },
  "results": [{ "inputIndex": 0, "success": true, "id": "wallet-record-uuid" }]
}
```

### Update a Wallet Record

Updates an existing expense record in BudgetBakers. The account cannot be changed after creation.

**Endpoint:** `PATCH /wallet/records`

**Request Body:**

```json
{
  "id": "wallet-record-uuid",
  "fileId": 12,
  "accountId": "36f3d28e-ab72-492b-aa8f-14d2d77d00d9",
  "categoryId": "5c5c03e9-000a-8000-8000-000000000000",
  "note": "1x Burger (8.50)\n1x Fries (3.84)",
  "amount": -12.34,
  "recordDate": "2025-03-15T13:22:00Z",
  "counterParty": "Downtown Bistro"
}
```

Same fields as create, plus `id` (the Wallet Record UUID returned on creation). The `accountId` is stored locally but not sent to BudgetBakers (it cannot be changed via the API).

**Response:** Same shape as create.

---

## Health Check

Check if the API is running and healthy.

**Endpoint:** `GET /health`

**Response:**

```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

## Error Responses

API errors follow this format:

```json
{
  "statusCode": 400,
  "message": "Bad Request",
  "details": "Provider 'invalid' is not available"
}
```

**Common Status Codes:**

| Code | Meaning |
|------|---------|
| 200 | Success |
| 400 | Bad request (invalid parameters) |
| 404 | Resource not found |
| 409 | Conflict (job already processing) |
| 500 | Server error |

## Rate Limiting

Currently not implemented, but recommended for production deployments.

## Webhooks

Currently not implemented. Poll `/ocr-jobs/:id` for job status updates.

## Examples

### Upload Multiple Files

```bash
curl -X POST http://localhost:3000/ocr-jobs/upload \
  -F "file=@receipt1.jpg" \
  -F "ocrProvider_0=mistral" \
  -F "file=@receipt2.jpg" \
  -F "ocrProvider_1=openai" \
  -F "jobName=Batch OCR"
```

### Monitor Job Status

```bash
#!/bin/bash

JOB_ID=$1

while true; do
  STATUS=$(curl -s http://localhost:3000/ocr-jobs/$JOB_ID | jq -r '.status')
  echo "Job status: $STATUS"
  
  if [ "$STATUS" = "completed" ] || [ "$STATUS" = "failed" ]; then
    break
  fi
  
  sleep 2
done
```

### Extract Text from Completed Job

```bash
curl -s http://localhost:3000/ocr-jobs/123 | \
  jq '.files[0].executions[0].ocrData | fromjson'
```

## Best Practices

1. **Handle Retries:** Implement exponential backoff when polling job status
2. **Validate Input:** Check file format and size before uploading
3. **Use Appropriate Providers:** Choose providers based on your accuracy and cost requirements
4. **Clean Up:** Periodically delete old jobs to manage storage
5. **Monitor Costs:** Track API usage if using cloud OCR providers

## Integration Examples

### JavaScript/Node.js

```javascript
const FormData = require('form-data');
const fs = require('fs');
const axios = require('axios');

async function uploadReceipt(filePath, provider) {
  const form = new FormData();
  form.append('file', fs.createReadStream(filePath));
  form.append('ocrProvider_0', provider);
  form.append('jobName', 'Receipt');

  const response = await axios.post(
    'http://localhost:3000/ocr-jobs/upload',
    form,
    { headers: form.getHeaders() }
  );

  return response.data.id;
}

async function waitForCompletion(jobId) {
  while (true) {
    const response = await axios.get(
      `http://localhost:3000/ocr-jobs/${jobId}`
    );

    if (response.data.status === 'completed') {
      return response.data;
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}
```

### Python

```python
import requests
import time
import json

def upload_receipt(file_path, provider):
    with open(file_path, 'rb') as f:
        files = {'file': f}
        data = {'ocrProvider_0': provider}
        response = requests.post(
            'http://localhost:3000/ocr-jobs/upload',
            files=files,
            data=data
        )
    return response.json()['id']

def wait_for_completion(job_id):
    while True:
        response = requests.get(f'http://localhost:3000/ocr-jobs/{job_id}')
        data = response.json()
        
        if data['status'] == 'completed':
            return data
        
        time.sleep(1)
```

### cURL

See examples above for basic cURL usage.
