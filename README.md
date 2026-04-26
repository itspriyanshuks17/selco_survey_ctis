
# ☀️ SELCO India — *Lighting Lives, Powering Livelihoods*

> *"Rural innovation succeeds when it is designed from the user's point of view — not the supplier's."*

A research website built by **Pitch Perfects** exploring how one social enterprise rewired the logic of rural development — and what that means for engineers who want to build things that actually matter.

---

## 🔦 What Is This?

This is a live, interactive case-study website for the course **Entrepreneurship for Engineers (GEX209)** at Ajeenkya DY Patil University, Pune.

We studied **SELCO India** — a company that didn't just sell solar panels. It built an entire ecosystem: finance, training, local technicians, community trust, and livelihood creation — all woven together. The result? 30 years of durable impact in places where most development efforts failed.

Our site documents that story. Completely. With real data, live survey responses, and a design worthy of the subject.

---

## ✨ Features

| Feature                           | What it does                                                               |
| --------------------------------- | -------------------------------------------------------------------------- |
| 🖼️**Image Gallery**       | A cinematic photo grid bringing SELCO's communities to life                |
| 📋**Embedded Survey**       | Google Form integrated directly into the page                              |
| 🔴**Live Responses**        | Pulls real-time data from Google Sheets — auto-refreshes every 60 seconds |
| 🔒**Privacy-Aware Display** | Only shows responses from participants who consented                       |
| 📱**Fully Responsive**      | Works beautifully on mobile, tablet, and desktop                           |
| ✨**Scroll Animations**     | Smooth reveal effects on every section                                     |

---

## 🗂️ Site Structure

```
Hero  →  Gallery  →  About  →  Problem  →  Methodology
  →  Case Studies  →  Analysis  →  Alternatives
    →  Recommendations  →  Team  →  Survey & Live Responses
```

---

## 👥 Team — Pitch Perfects

| Name                   | Initials |
| ---------------------- | -------- |
| Neha Gaikwad           | NG       |
| Meghana Prathipati     | MP       |
| Vaishnavi Jadhav       | VJ       |
| Saylee Shelar          | SS       |
| Vaibhav Gulage         | VG       |
| Priyanshu Kumar Sharma | PS       |

**Subject Guide:** Prof. Parmeshwari Aland
**University:** Ajeenkya DY Patil University, Pune
**Branch:** B.Tech IT — Cloud Technology & Information Security
**Semester:** Sem 8 · 2025

---

## 🚀 Deploy to GitHub Pages

### One-time setup

1. Push this repository to GitHub
2. Go to **Settings → Pages**
3. Under *Source*, select **GitHub Actions**
4. That's it — the `deploy.yml` workflow handles everything automatically on every push to `main`

Your live site will be at:

```
https://<your-username>.github.io/<repo-name>/
```

### Make the Google Sheet public (required for live responses)

1. Open your Google Sheet: [responses sheet](https://docs.google.com/spreadsheets/d/17kgCRTz1ODbfxlKsMptYpSfRfbeDt1dB26CNL1xU7yM)
2. Click **Share → Anyone with the link → Viewer**
3. The live responses panel on the site will start populating automatically

### Fix the Google Form embed

1. Open your form at [forms.gle/dbopbiyLbBYNZJZ26](https://forms.gle/dbopbiyLbBYNZJZ26)
2. Click **Send → Embed (< >)** → copy the `src` URL
3. Replace the placeholder `src` in the `<iframe>` inside `index.html`

---

## 🏗️ Tech Stack

```
HTML5 + CSS3 + Vanilla JS      no frameworks, no build tools
Google Fonts (DM Serif Display + DM Sans)
Google Forms (survey embed)
Google Sheets gviz API (live response fetching)
GitHub Actions (automated deployment)
```

---

## 📁 Files

```
index.html      — the entire website (single file, self-contained)
deploy.yml      — GitHub Actions workflow for Pages deployment
README.md       — you're reading it
```

---

## 📚 About SELCO India

SELCO India was founded in **1995** by Harish Hande with a simple but radical idea: poor people are not a charity problem — they are underserved customers. With the right financing, service, and ecosystem support, rural communities can and will adopt clean energy if it genuinely improves their lives.

Today SELCO has electrified **2 million+ homes**, empowered **30,000+ livelihoods**, and powered **5,900+ health facilities** — not through subsidies alone, but through deep user understanding and ecosystem design.

Learn more: [selco-india.com](https://selco-india.com)

---

<p align="center">Made with 🌱 by Pitch Perfects · ADYPU · 2025</p>
