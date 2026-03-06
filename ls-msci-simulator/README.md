# MSCI Argentina Inclusion Simulator
**Latin Securities — Research Tool**

Simulates MSCI Argentina Frontier and Emerging Markets reclassification:
constituent eligibility screening, passive & active inflow estimates, and days-of-trading impact analysis.

---

## Stack
- **React 18** + **Vite 5**
- **SheetJS (xlsx)** — Excel export
- **jsPDF + jspdf-autotable** — PDF export
- Deployed on **Vercel**

---

## Local development

```bash
npm install
npm run dev
# → http://localhost:5173
```

---

## Deploy to GitHub + Vercel

### Step 1 — Create GitHub repo

```bash
# In this folder:
git init
git add .
git commit -m "feat: MSCI Argentina Inclusion Simulator"

# On GitHub: create new repo "ls-msci-simulator" (no README, no .gitignore)
# Then:
git remote add origin https://github.com/YOUR_USERNAME/ls-msci-simulator.git
git branch -M main
git push -u origin main
```

### Step 2 — Deploy to Vercel

**Option A — Vercel dashboard (recommended)**
1. Go to https://vercel.com → **Add New Project**
2. Import your `ls-msci-simulator` GitHub repo
3. Framework: **Vite** (auto-detected)
4. Build command: `npm run build`
5. Output directory: `dist`
6. Click **Deploy** → done in ~60 seconds

**Option B — Vercel CLI**
```bash
npm i -g vercel
vercel login
vercel --prod
```

### Step 3 — Custom domain (optional)
In Vercel dashboard → Settings → Domains → add `msci.latinsecurities.com` or similar.

---

## Future deploys
Every `git push` to `main` triggers an automatic Vercel redeploy.

```bash
git add .
git commit -m "update: ..."
git push
```

---

## Export features
- **Export Excel** — 4 sheets: Summary, Constituents, Flow Breakdown, Precedents
- **Export PDF** — 2-page landscape A4: constituent table + flow breakdown with LS branding

---

## Disclaimer
This tool is for analytical and research purposes only. Not investment advice.
© Latin Securities
