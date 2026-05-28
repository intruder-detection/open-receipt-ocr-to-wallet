---
layout: default
title: Home
nav_order: 1
---

# Open Receipt OCR

A powerful, flexible, and extensible OCR (Optical Character Recognition) platform designed specifically for receipts and documents. It supports a wide range of OCR providers, from cloud-based AI models to local engines.

## ✨ Key Features

- **Wallet Integration**: Upload a receipt and have it land in Wallet by BudgetBakers automatically — amount, date, category, and merchant all extracted by AI
- **Multi-Provider Support**: Choose from 10+ OCR engines (local and cloud-based)
- **No Single Vendor Lock-in**: Seamlessly switch between providers based on your needs
- **Local Processing**: Run OCR locally using PaddleOCR or Tesseract.js without API calls
- **Cloud Options**: Leverage advanced AI models from OpenAI, Google Gemini, Mistral, and more
- **Docker Ready**: Deploy the entire stack with a single command
- **Headless API**: Integrate OCR processing into your workflows via REST API
- **Extensible Architecture**: Add custom OCR providers, storage backends, and secret managers
- **Multi-Language Support**: Built-in internationalization (English, Portuguese, French)

## 🚀 Quick Start

```bash
# Clone the repository
git clone https://github.com/iursevla/open-receipt-ocr.git
cd open-receipt-ocr

# Setup environment
cp server/.env.example server/.env
# Edit server/.env with your API keys

# Run development server
npm run dev

# Access the app
open http://localhost:3000
```

## 📸 Screenshots & Demo

<video src="assets/screenshots/open-receipt-ocr.mp4" controls width="100%"></video>

| Dashboard | OCR Jobs (Card View) | OCR Jobs (Table View) |
|:---:|:---:|:---:|
| ![Dashboard](assets/screenshots/dashboard-view.png) | ![Card view](assets/screenshots/ocr-jobs-card-view.png) | ![Table view](assets/screenshots/ocr-jobs-table-view.png) |

| Create Job | Multiple Files | Image Crop |
|:---:|:---:|:---:|
| ![Create job](assets/screenshots/add-ocr-job-modal.png) | ![Multiple files](assets/screenshots/add-ocr-modal-multiple-files.png) | ![Crop](assets/screenshots/add-ocr-modal-apply-crop.png) |

| Job Detail — Results | Job Detail — Failed | Settings |
|:---:|:---:|:---:|
| ![Results](assets/screenshots/ocr-job-modal.png) | ![Failed](assets/screenshots/ocr-job-modal-failed.png) | ![Settings](assets/screenshots/default-settings-modal.png) |

| Dark Mode | Localisation (German) |
|:---:|:---:|
| ![Dark mode](assets/screenshots/dark-mode.png) | ![German UI](assets/screenshots/ocr-jobs-language-selector.png) |

[→ See all screenshots with descriptions](./screenshots.md)

## 📖 Documentation

- [Getting Started](./getting-started.md) - Installation and basic setup
- [Screenshots](./screenshots.md) - UI screenshots and feature tour
- [Configuration](./configuration.md) - Configure OCR and storage providers
- [API Usage](./api.md) - Integrate via REST API
- [Development Guide](./development.md) - Code structure and development
- [Extending](./extending.md) - Add custom providers and features
- [Docker Deployment](./docker.md) - Deploy using Docker Compose

## 🏗️ Architecture

The application is built with:

- **Frontend**: Angular + PrimeNG for a responsive UI
- **Backend**: NestJS with BullMQ for async job processing
- **Database**: SQLite (via TypeORM)
- **Cache**: Redis (required for BullMQ)
- **Container**: Docker & Docker Compose

## 🔌 Supported OCR Providers

### Local (No API Keys)
- **PaddleOCR Local** - High-quality local OCR
- **Tesseract.js** - Open-source WASM-based OCR
- **llama.cpp** - Advanced vision models (LLaVA, Qwen-VL)

### Cloud (API Keys Required)
- **Gemini → Wallet** ⭐ — end-to-end receipt-to-expense pipeline with Wallet by BudgetBakers
- TabScanner, Google Gemini, OpenAI, Mistral, xAI Grok, AWS Textract, PaddleOCR API

See [Configuration](./configuration.md) for details on setting up each provider.

## 💾 Storage Options

- **Local** (default) - Store files on your server
- **OneDrive** - Cloud storage via Microsoft Graph

## 🔐 Secret Management

- **Environment Variables** (default) - Simple `.env` file based configuration
- **Infisical** - Enterprise secret management integration

## 📋 Requirements

- Node.js 18+
- npm or yarn
- Docker & Docker Compose (for containerized deployment)
- Redis (for background job processing)

## 🤝 Contributing

We welcome contributions! See [Development Guide](./development.md) for instructions on:
- Setting up the development environment
- Code structure and conventions
- Running tests
- Submitting pull requests

## 📝 License

This project is open source. Check the repository for license details.

## 🆘 Support

For issues and questions:
- [GitHub Issues](https://github.com/iursevla/open-receipt-ocr/issues)
- Check existing documentation for common questions
