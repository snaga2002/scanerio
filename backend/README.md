# Figma-to-Test Backend

FastAPI backend for generating test scenarios from Figma designs and other inputs using Azure OpenAI.

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Configure environment variables:
```bash
cp .env.example .env
# Edit .env with your Azure OpenAI credentials
```

3. Run the server:
```bash
python app.py
```

Or with uvicorn directly:
```bash
uvicorn app:app --host 0.0.0.0 --port 8000 --reload
```

## API Endpoints

- `POST /generate-scenarios` - Generate test scenarios from text, URL, or files
- `POST /feedback` - Submit feedback on generated scenarios
- `GET /healthz` - Health check
- `GET /health/aoai` - Azure OpenAI health check

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `AZURE_OPENAI_KEY` | Azure OpenAI API key | Yes |
| `AZURE_OPENAI_ENDPOINT` | Azure OpenAI endpoint URL | Yes |
| `AZURE_OPENAI_CHAT_DEPLOYMENT` | Deployment name | Yes |
| `OPENAI_API_VERSION` | API version | No (default: 2024-02-15-preview) |
| `FIGMA_TOKEN` | Figma API token | No |

## Supported File Types

- `.txt` - Plain text
- `.json` - JSON files
- `.csv` - CSV files
- `.html`, `.htm` - HTML files
- `.md`, `.markdown` - Markdown files
- `.pdf` - PDF documents (requires pdfminer.six)
- `.png`, `.jpg`, `.jpeg` - Images (requires pytesseract)
- `.docx` - Word documents (requires python-docx)
