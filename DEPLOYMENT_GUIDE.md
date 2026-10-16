# Startup & Deployment Guide

Step-by-step instructions to run locally and deploy **Attendly** (FastAPI backend + React Vite frontend).

---

## Prerequisites

- **Python**: 3.10+
- **Node.js**: 18+ (with `npm`)

---

## 1. Local Development Setup

### Backend (Terminal 1)

```bash
cd backend

# 1. Create and activate virtual environment
python -m venv .venv
# Windows:
.venv\Scripts\activate
# Linux/macOS:
source .venv/bin/activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. (Optional) Install Playwright browser for portal sync feature
playwright install chromium

# 4. Start backend server (runs on http://127.0.0.1:8000)
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

> **Windows One-Click Shortcut**: Double-click [start_app.bat](file:///d:/NOTES/Antigravity%20Notes/AttendanceCALCULATOR/start_app.bat) in the project root to start both backend & frontend and open your browser automatically.

---

### Frontend (Terminal 2)

```bash
cd frontend

# 1. Install dependencies
npm install

# 2. Start Vite dev server (runs on http://localhost:5173)
npm run dev
```

Open your browser at **`http://localhost:5173`**. Requests to `/api/*` are automatically proxied to `http://localhost:8000`.

---

## 2. Production Deployment

### Option A: Self-Hosted (Single Server / VPS)

#### Step 1: Build Frontend
```bash
cd frontend
npm install
npm run build
```
This produces optimized static assets in `frontend/dist/`.

#### Step 2: Set Up Backend Service
```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
playwright install chromium
```

Run as a systemd service or background supervisor:
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 2
```

#### Step 3: Configure Reverse Proxy (Nginx)
```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Serve built frontend static files
    location / {
        root /path/to/AttendanceCALCULATOR/frontend/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # Proxy API calls to backend
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

### Option B: Cloud Hosting (PaaS)

#### 1. Backend (Render / Railway)
- **Root Directory**: `backend`
- **Build Command**: `pip install -r requirements.txt && playwright install chromium --with-deps`
- **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- **CORS Config**: In `backend/app/main.py`, ensure your production frontend URL is added to `allow_origins`.

#### 2. Frontend (Vercel / Netlify / Cloudflare Pages)
- **Root Directory**: `frontend`
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Rewrites / Proxy**: Add a rewrite for `/api/:path*` pointing to `https://your-backend-api.onrender.com/api/:path*`.

---

## 3. Verification & Health Check

| Check | URL / Command | Expected Result |
| :--- | :--- | :--- |
| **Backend Health** | `GET http://127.0.0.1:8000/api/health` | `{"status":"ok"}` |
| **API Docs (Swagger)** | `GET http://127.0.0.1:8000/docs` | Interactive Swagger UI |
| **Frontend UI** | `GET http://localhost:5173` | Attendly Dashboard / Upload View |
