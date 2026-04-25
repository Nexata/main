# Documents API Endpoints — Request Examples

## Base URL
```
http://localhost:3000
```

## Headers (all requests)
```http
Authorization: Bearer xd
```

Legajox credentials can be sent as `user` / `password` query params, but they are optional when the API server has `DEFAULT_USER` and `DEFAULT_PASSWORD` configured.

---

## 1. GET `/documents/list` — List folders or files

### 1a. List top-level folders (root)
**Request:**
```http
GET /documents/list
Authorization: Bearer xd
```

**Response:**
```json
{
  "cursor": null,
  "entries": [
    {
      "id": "/files/edit/11111",
      "name": "Contratos",
      "nexataId": null,
      "path": "/files/edit/11111",
      "ext": "dir",
      "extra": {
        "cantidadArchivos": 42
      }
    },
    {
      "id": "/files/edit/22222",
      "name": "Liquidaciones",
      "nexataId": null,
      "path": "/files/edit/22222",
      "ext": "dir",
      "extra": {
        "cantidadArchivos": 158
      }
    }
  ]
}
```

### 1b. List files inside a specific folder
**Request:**
```http
GET /documents/list?path=/files/edit/11111
Authorization: Bearer xd
```

**Response:**
```json
{
  "cursor": null,
  "entries": [
    {
      "id": "/enviar_doc/45812",
      "name": "contrato-plazo-fijo.pdf",
      "nexataId": null,
      "url": "/enviar_doc/45812",
      "ext": "pdf",
      "updatedAt": "2025-07-31T11:25:00.000Z",
      "extra": {
        "firmado": true,
        "fecha": "31/07/2025 11:25hs"
      }
    },
    {
      "id": "/enviar_doc/45813",
      "name": "addenda-modificatoria.docx",
      "nexataId": null,
      "url": "/enviar_doc/45813",
      "ext": "docx",
      "updatedAt": "2025-08-15T14:30:00.000Z",
      "extra": {
        "firmado": false,
        "fecha": "15/08/2025 14:30hs"
      }
    }
  ]
}
```

---

## 2. GET `/documents/search` — Full-text file search

### Request
```http
GET /documents/search?q=contrato
Authorization: Bearer xd
```

**Notes:**
- Query param `q` is **required** and must be **at least 3 characters**.
- Case-insensitive search.
- `user` and `password` query params are optional when `DEFAULT_USER` and `DEFAULT_PASSWORD` exist on the server.

### Response
```json
{
  "cursor": null,
  "entries": [
    {
      "id": "/enviar_doc/45812",
      "name": "contrato-plazo-fijo.pdf",
      "nexataId": null,
      "url": "https://app.legajox.com/enviar_doc/45812",
      "path": "/enviar_doc/45812",
      "ext": "pdf",
      "extra": {
        "carpeta": "Contratos"
      }
    },
    {
      "id": "/enviar_doc/48901",
      "name": "contrato-teletrabajo.pdf",
      "nexataId": null,
      "url": "https://app.legajox.com/enviar_doc/48901",
      "path": "/enviar_doc/48901",
      "ext": "pdf",
      "extra": {
        "carpeta": "Recursos Humanos"
      }
    }
  ]
}
```

---

## 3. POST `/documents/download` — Trigger download of selected items

### Request
```http
POST /documents/download
Authorization: Bearer xd
Content-Type: application/json

{
  "selection": [
    {
      "id": "/files/edit/11111",
      "isDir": true
    },
    {
      "id": "/enviar_doc/45812",
      "isDir": false
    }
  ]
}
```

**Body Structure:**
- `selection`: Array of objects with:
  - `id`: string (folder path if `isDir: true`, document URL if `isDir: false`)
  - `isDir`: boolean (true = folder, false = individual file)

### Response
```json
{
  "cursor": null,
  "entries": [
    {
      "id": "/enviar_doc/45812",
      "name": "contrato-plazo-fijo.pdf",
      "nexataId": null,
      "url": "/enviar_doc/45812",
      "size": 1.25,
      "path": "/outputs/_descargas_tmp/contrato-plazo-fijo.pdf",
      "ext": "pdf",
      "updatedAt": "2025-07-31T11:25:00.000Z",
      "extra": {
        "estado": "ok",
        "firmado": true,
        "dirNombre": "Contratos"
      }
    },
    {
      "id": "/enviar_doc/45813",
      "name": "addenda-modificatoria.docx",
      "nexataId": null,
      "url": "/enviar_doc/45813",
      "size": 0.89,
      "path": "/outputs/_descargas_tmp/addenda-modificatoria.docx",
      "ext": "docx",
      "updatedAt": "2025-08-15T14:30:00.000Z",
      "extra": {
        "estado": "ok",
        "firmado": false,
        "dirNombre": "Contratos"
      }
    },
    {
      "id": "/enviar_doc/45814",
      "name": "archivo-corrupto.pdf",
      "nexataId": null,
      "url": "/enviar_doc/45814",
      "path": null,
      "ext": "pdf",
      "updatedAt": "2025-06-10T09:15:00.000Z",
      "extra": {
        "estado": "error",
        "firmado": false,
        "dirNombre": "Contratos",
        "errorDetalle": "HTTP 404 al descargar https://app.legajox.com/enviar_doc/45814"
      }
    }
  ]
}
```

---

## Metadata Fields Explanation

| Field | Type | Present In | Description |
|-------|------|-----------|-------------|
| `id` | string | All | Unique identifier (href, URL, or path) |
| `name` | string | All | Display name of the file/folder |
| `nexataId` | null | All | Always `null` (not available from Legajox) |
| `url` | string | Files only | Full URL or relative path to the document |
| `size` | number | Download only | File size in MB |
| `path` | string | Download only | Local file path after download |
| `ext` | "dir" \| string | All | File extension or "dir" for folders |
| `updatedAt` | Date | Files only | Parsed document date from Legajox |
| `extra` | object | All | Additional metadata depends on context |

### `extra` field by endpoint:

**List (folders):**
```json
{ "cantidadArchivos": 42 }
```

**List (files):**
```json
{ "firmado": true, "fecha": "31/07/2025 11:25hs" }
```

**Search:**
```json
{ "carpeta": "Contratos" }
```

**Download (success):**
```json
{
  "estado": "ok",
  "firmado": true,
  "dirNombre": "Contratos"
}
```

**Download (error):**
```json
{
  "estado": "error",
  "firmado": false,
  "dirNombre": "Contratos",
  "errorDetalle": "HTTP 404..."
}
```

**Download (duplicate):**
```json
{
  "estado": "duplicado",
  "firmado": true,
  "dirNombre": "Contratos"
}
```

---

## Error Responses

### Missing credentials
```http
HTTP 400
```
```json
{
  "error": "Query params 'user' and 'password' are required when DEFAULT_USER and DEFAULT_PASSWORD are not configured."
}
```

### Search query too short
```http
HTTP 400
```
```json
{
  "error": "Query param 'q' must be at least 3 characters."
}
```

### Scrape failed
```http
HTTP 500
```
```json
{
  "error": "Scrape failed",
  "details": ["Access denied: user does not have permissions for this page."]
}
```

### Timeout
```http
HTTP 500
```
```json
{
  "error": "Scrape timeout after 5 minutes"
}
```

---

## cURL Examples

### List folders
```bash
curl -H "Authorization: Bearer xd" \
  "http://localhost:3000/documents/list"
```

### List files in folder
```bash
curl -H "Authorization: Bearer xd" \
  "http://localhost:3000/documents/list?path=/files/edit/11111"
```

### Search files
```bash
curl -H "Authorization: Bearer xd" \
  "http://localhost:3000/documents/search?q=contrato"
```

### Download selection
```bash
curl -X POST \
  -H "Authorization: Bearer xd" \
  -H "Content-Type: application/json" \
  -d '{
    "selection": [
      {"id": "/files/edit/11111", "isDir": true},
      {"id": "/enviar_doc/45812", "isDir": false}
    ]
  }' \
  "http://localhost:3000/documents/download"
```
