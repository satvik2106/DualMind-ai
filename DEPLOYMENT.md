# DualMind OS Deployment Guide

This guide details the steps to deploy the DualMind AI Operating System to production.

## Architecture Overview
- **Frontend**: Next.js 15 (React) - Deployed on **Vercel**.
- **Backend**: FastAPI (Python) - Deployed on **Railway/Render/Fly.io** (Dockerized).
- **Database/Auth**: **Firebase Spark Tier** (Firestore + Auth).

---

## 1. Firebase Setup (Production)
1. Create a new Firebase Project (or use existing).
2. Enable **Authentication** (Google or Email/Password).
3. Enable **Cloud Firestore** in production mode.
4. Add the `firestore.rules` provided in this repository.
5. Generate a **Service Account Key** (JSON) and copy its content.

---

## 2. Backend Deployment (FastAPI)
Deploy using the provided `Dockerfile`.

### Environment Variables
| Variable | Description |
|----------|-------------|
| `FIREBASE_SERVICE_ACCOUNT_KEY` | The full JSON string of your service account key. |
| `ALLOWED_ORIGINS` | `https://your-frontend-domain.vercel.app` |
| `OPENROUTER_API_KEY` | Your AI model provider key. |
| `NVIDIA_API_KEY` | (Optional) For specialized NVIDIA inference. |

### Steps
1. Push the repository to GitHub.
2. Link your repository to **Railway.app**.
3. Railway will automatically detect the `Dockerfile` and deploy.
4. Copy your backend URL (e.g., `https://dualmind-api.railway.app`).

---

## 3. Frontend Deployment (Next.js)
Deploy to **Vercel**.

### Environment Variables
| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Your Firebase Web Config. |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Your Firebase Web Config. |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Your Firebase Web Config. |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Your Firebase Web Config. |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Your Firebase Web Config. |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Your Firebase Web Config. |
| `NEXT_PUBLIC_BACKEND_URL` | The URL of your deployed backend. |

### Steps
1. Link your repository to **Vercel**.
2. Set the `Root Directory` to `frontend_v2`.
3. Add the environment variables.
4. Deploy.

---

## 4. Final Verification
1. Ensure `ALLOWED_ORIGINS` on the backend matches the Vercel URL.
2. Verify that the `Authorization: Bearer <token>` header is flowing from the frontend to the backend.
3. Check the `/api/health` endpoint on your production backend.

---

## Performance & Optimization
- **Spark Plan Limits**: DualMind uses batched writes (flushing every 5s) to stay within the 20k free daily writes.
- **SSE Streaming**: Ensure your host supports long-lived HTTP connections (Railway and Render do by default).
