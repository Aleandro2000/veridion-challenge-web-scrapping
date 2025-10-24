# Project Resume — Company Data API

## Objective
The goal of this project is to build a smart company data API that automatically scrapes, stores, and serves structured company information (such as phone numbers, addresses, and social links) from a list of websites.

It also includes:
- Fuzzy searching for best-match queries implemented directly in MongoDB, achieving behavior similar to ElasticSearch without the added infrastructure and additional costs.
- Monthly automated scraping using cron jobs
- MongoDB indexing for fast text search and retrieval

## Tech Stack

| Component | Technology |
|------------|-------------|
| Backend Framework | Fastify (Node.js + TypeScript) |
| Database | MongoDB (Mongoose ODM) |
| Scraper | Puppeteer + Chromium |
| Text Search | Fuse.js (Fuzzy Search) + MongoDB Text Index |
| Scheduler | node-cron |
| Containerization | Docker |

## System Overview

```
+----------------------------------+
| sample-websites-company-names.csv|
+---------+------------------------+
          |
          v
  ┌─────────────────────┐
  │ contactSchedule Job │  <- Runs monthly via cron
  └─────────┬───────────┘
            │
     [Scraping Logic]
            ↓
  ┌────────────────────────────┐
  │ contactScrapping(url)      │
  │  • Launch Puppeteer        │
  │  • Visit main + contact pages
  │  • Extract phones, address,
  │    socials, coordinates     │
  └──────────┬─────────────────┘
             │
   Stored in MongoDB (contacts collection)
             │
             ▼
  ┌──────────────────────────┐
  │ Fastify API Endpoints    │
  │  /search?q=...           │  <- Fuzzy + indexed search
  │  /getById?id=...         │  <- Retrieve exact record
  └──────────────────────────┘
```

## Scraping Logic (contactScrapping.ts)

### 1. Setup and Navigation
- Uses `puppeteer-core` with a local `chromium` binary for lightweight automation.
- Opens the target URL and waits for DOM content to load.
- Attempts to close cookie popups or overlays automatically.

### 2. Extracting Contact Information

#### Address and Coordinates
The scraper uses a multi-layered fallback logic:
1. Google Maps iframes or links -> extract coordinates from `@lat,lng` or `?q=...`
2. Structured JSON-LD (`<script type="application/ld+json">`) -> parse business schema for address and geo data
3. Meta tags (`geo.position`) -> read coordinates if present
4. OpenStreetMap embeds -> fallback for non-Google sites
5. `<address>` tags or text blocks in footers
6. Regex-based extraction (via `addressRegex` and utility functions)

#### Phone Numbers
- Extracts visible phone-like patterns using a regex (`phoneRegex`)
- Normalizes and validates them via `libphonenumber-js` to E.164 format
- Adds numbers found in `tel:` links

#### Social Links
Finds all `<a href>` links and classifies them:
- Facebook -> `socials.facebook`
- Instagram -> `socials.instagram`
- LinkedIn -> `socials.linkedin`
- Twitter/X -> `socials.twitter`
- TikTok -> `socials.tiktok`

### 3. Recursive Exploration
The scraper also visits related pages such as:
- `/contact`
- `/about`
- `/impressum`
- `/location`
- `/terms`

It merges all new data (phones, socials, address, coordinates) into the main record until enough data is collected.

### 4. Example Output

```json
{
  "url": "https://mazautoglass.com/",
  "phones": ["+14155552671"],
  "socials": {
    "facebook": "https://facebook.com/mazautoglass",
    "instagram": "https://instagram.com/mazautoglass"
  },
  "address": "230 Bayshore Blvd, San Francisco, CA 94124",
  "coords": { "lat": 37.7441, "lng": -122.4012 },
  "success": true
}
```

## MongoDB Data Model

```ts
{
  _id: ObjectId,
  id: Number, // auto-incremented
  url: String,
  phones: [String],
  socials: { facebook, instagram, linkedin, twitter, tiktok },
  address: String,
  coords: { lat, lng },
  success: Boolean,
  error: String,
  createdAt: Date,
  updatedAt: Date
}
```

### Indexing
Text index is defined for all searchable fields:

```ts
contactDataSchema.index({
  _id: "text",
  url: "text",
  address: "text",
  "socials.facebook": "text",
  "socials.instagram": "text",
  "socials.linkedin": "text",
  "socials.twitter": "text",
  "socials.tiktok": "text"
});
```

## Search API Logic

### Endpoint: `/search`
- Accepts query `q`, pagination, sorting, and optional `near` (geo-filter)
- Tries MongoDB full-text search first
- Falls back to regex search if no text match
- Then applies Fuse.js fuzzy search in-memory for smart ranking

Results are sorted by similarity score and paginated for client consumption.

## Automatic Monthly Re-scraping

### Cron Schedule
To ensure data remains up-to-date, the system uses a scheduled job that runs every month.

```ts
cron.schedule("0 0 1 * *", contactSchedule);
```

This job:
- Runs on the 1st of every month at midnight
- Revalidates all URLs in `sample-websites-company-names.csv`
- Updates existing MongoDB documents if the website already exists
- Creates new entries for new domains

## Metrics and Deliverables

| Metric | Description |
|--------|-------------|
| Coverage | Percentage of websites successfully scraped and stored |
| Fill-rate | Completeness of each profile (phones, address, socials) |
| Search performance | Average response time for `/search` |
| Data freshness | Days since last successful scrape |

## Example Usage

```bash
# Query API
GET /search?q=mazautoglass
GET /getById?id=68fa87a0695c0af524150ca7
```

Example Response:

```json
{
  "status": 200,
  "total": 1,
  "results": [
    {
      "url": "https://mazautoglass.com/",
      "address": "230 Bayshore Blvd, San Francisco, CA 94124",
      "phones": ["+14155552671"],
      "_score": 0.98
    }
  ]
}
```

## Summary

- Scraping Layer: Puppeteer extracts structured data automatically  
- Database Layer: MongoDB with text and fuzzy search  
- API Layer: Fastify exposes `/search` and `/getById` endpoints  
- Automation Layer: Cron job runs monthly to refresh data  