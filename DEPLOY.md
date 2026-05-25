# Deploying to Render (Free Tier) with Database Persistence

This guide explains how to deploy your Trading Journal app to **Render** completely free of charge, while ensuring your trade data is persisted using a free serverless PostgreSQL database from **Neon**.

---

## Why Neon PostgreSQL + Render?
- **Render (Free Tier)**: Perfect for hosting the Node.js backend & frontend. However, Render's free tier has **ephemeral storage** (no persistent disks). If you use SQLite (`trades.db`), your database will be wiped every time the server restarts or redeploys.
- **Neon (Free Tier)**: Provides a free, fully managed serverless PostgreSQL database that does not expire. By linking Neon to Render, your trades will be saved permanently, even when the Render app sleeps or restarts.

---

## Step 1: Set Up your GitHub Repository

Render deploys directly from GitHub. If you haven't already:
1. Initialize git in your project:
   ```bash
   git init
   ```
2. Commit your code:
   ```bash
   git add .
   git commit -m "Configure port and prepare for Render deployment"
   ```
3. Create a new repository on GitHub (keep it private if you want to protect your code) and push your files:
   ```bash
   git remote add origin <your-github-repo-url>
   git branch -M main
   git push -u origin main
   ```

---

## Step 2: Create a Free PostgreSQL Database on Neon

1. Go to [Neon.tech](https://neon.tech/) and sign up for a free account.
2. Create a new project (e.g., `trading-journal`).
3. Under the **Dashboard**, copy your **Connection String** (Postgres URL). It will look like this:
   `postgres://alex:abcd1234@ep-cool-snowflake-123456.us-east-2.aws.neon.tech/neondb?sslmode=require`
4. Keep this connection string safe.

---

## Step 3: Deploy the Node App on Render

1. Go to [Render.com](https://render.com/) and sign up/log in (using your GitHub account is recommended).
2. Click **New +** and select **Web Service**.
3. Connect your GitHub repository containing the trading journal.
4. Configure the Web Service settings:
   - **Name**: `trading-journal` (or any name you prefer)
   - **Language**: `Node`
   - **Branch**: `main`
   - **Region**: Select the region closest to you (e.g., Oregon, Ohio, Frankfurt, Singapore)
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Select **Free**

5. Scroll down and click the **Advanced** button to add Environment Variables:
   - **Add Environment Variable**:
     - **Key**: `DATABASE_URL`
     - **Value**: *Paste the Neon Connection String you copied in Step 2*
   - *(Optional) If using Google Sign-In*:
     - **Key**: `GOOGLE_CLIENT_ID`
     - **Value**: *Your Google OAuth Client ID* (obtained from Google Developer Console)

6. Click **Create Web Service**.

---

### (Optional) Step 3.5: Set Up Google Sign-In
If you want to use Google authentication instead of skip/bypass demo mode:
1. Go to the **[Google Cloud Console](https://console.cloud.google.com/)**.
2. Navigate to **APIs & Services** > **Credentials**.
3. Click **Create Credentials** > **OAuth Client ID**.
4. Set Application Type to **Web application**.
5. Under **Authorized JavaScript origins**, add:
   * `http://localhost:3000` (for local development)
   * `https://<your-render-app-name>.onrender.com` (your deployed Render app URL)
6. Click **Create** and copy your **Client ID**.
7. In the Render Web Service dashboard, go to the **Environment** tab, add `GOOGLE_CLIENT_ID` with that copied value, and save. The app dynamically fetches this key at runtime so you don't have to check it into Git!

---

## Step 4: Access Your App

Render will begin building and deploying your app. 
- Once the deployment is complete, Render will provide a public URL (e.g., `https://trading-journal.onrender.com`).
- Click the URL to open your app!
- The app will automatically initialize the PostgreSQL database tables on the first launch and seed the sample trades.

---

## Good to Know (Render Free Tier Limits)

1. **Spin Down / Cold Starts**: If your web service doesn't receive any web traffic for 15 minutes, Render will temporarily spin it down. When someone visits the URL next, it will trigger a "cold start" which takes about 30 to 50 seconds to boot up.
2. **Ephemeral File System**: Remember that the local sqlite (`trades.db`) will NOT save data persistently on Render. Make sure the `DATABASE_URL` environment variable is correctly pasted so the app runs in Postgres mode.
