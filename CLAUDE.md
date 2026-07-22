# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

SoftDev-V2 (`softdev-api`) is an Express.js REST API for a retail/POS system: product/inventory management, sales transactions, loans, drawers/cash management, customer management, reservations, promotions, and reporting. Data is stored in MongoDB via Mongoose; file uploads go to MinIO (S3-compatible object storage).

## Commands

- `npm start` — run the server with plain Node (`node app.js`)
- `npm run dev` — run with nodemon (auto-restart on change)
- `npm run dockerBuild` — build the production Docker image
- `npm run dockerPush` — push the production Docker image

There is no test suite, linter, or build step configured in this repo.

The server reads `PORT`/`HOST` from `.env` (see `.env.example` for the full list of required variables — Mongo, MinIO, JWT secrets, Telegram bot, invoice numbering, QZ Tray keys). Copy `.env.example` to `.env` before running locally.

## Architecture

**Request flow**: `app.js` → `routes/router.js` → per-module route files → `middleware/security` (auth/role) → controller function → Mongoose model.

### Routing

- `routes/router.js` is the single entry point mounted at `/`. It handles the `/uploads/:filename` proxy to MinIO directly, then mounts feature routers.
- Every router below it is a folder with an `index.js` that composes sub-routers (e.g. `routes/organize/index.js` mounts `category`, `brand`, `product`, `store`, `customer`, `preset`).
- **Auth boundary**: `routes/auth` and `routes/config` are mounted *before* `router.use(require('../middleware/security').auth)` — everything else requires a valid `x-access-token`. Route files never call the auth middleware directly; it's applied once, globally, at the router level.
- Individual route files apply two more middlewares per-endpoint: `security.role(privilege.<module>.<action>)` for permission checks and `security.audit()` to log the action to the `Activity` collection. Look at an existing route file (e.g. `routes/organize/product.js`) as the template for adding new endpoints — the pattern (list/detail/create/update/disable, often plus excel import/export and nested sub-resources) repeats across nearly every module.

### Controllers

- One file per resource in `controllers/`, exporting plain async functions (`index`, `list`, `detail`, `create`, `update`, `disable`, `_import`, `_export`, `batch`, etc.). Controllers are wired to routes by destructuring the needed exports in the route file.
- Controllers validate input with Joi schemas from `middleware/validations/<resource>Validation.js`, then call Mongoose directly (mixed callback/promise style — this codebase does not consistently use async/await for Mongoose calls, so match whichever style the surrounding function already uses).
- Responses always go through `helpers/response.js` (`response.success(code, data, res)` / `response.failure(code, data, res, error)`), which looks up a code name from `constants/statusCodes.js` and merges it into the JSON body. Never call `res.json` directly in a controller — use these helpers so response shape stays consistent.
- Soft deletion is the norm: records are flagged `isDeleted: true` rather than removed; most queries filter `{ isDeleted: false }`.

### Authorization model

- `constants/roleMap.js` defines the full `privilege` tree (menu/route → action → boolean), used both to seed the default Super Admin role (`configs/db.js`, on first boot when no users exist) and to gate routes via `security.role(privilege.x.y)`.
- `middleware/security/index.js` also exposes `hash` (HMAC-style body signing check using `HASH_SECRET`, `x-access-hash`/`x-access-ts` headers — used for endpoints that need tamper-proofing) and `self` (restricts a route to the request's own user id).
- JWT tokens are verified in `auth`; on `TokenExpiredError` it automatically issues and returns a `refresh_token` in the failure response rather than just rejecting.

### Data/business logic

- `helpers/utils.js` is the shared business-logic module (exported as the `utils` object) — stock allocation (`determineProductStock`, `checkProductStock`, `reverseProductStock`), payment math (`calculatePromotion`, `calculateService`, `calculatePaymentTotal`, `calculateReturnCashes`), invoice numbering (`generateInvoice`, driven by `INVOICE_PREFIX`/`INVOICE_RESET_PERIOD`/`INVOICE_PAD_START` env vars), loan amortization (`generateLoanPayment`, `generateLoanPreview`), and Excel import parsing (`readExcel`). New cross-controller business logic belongs here, not duplicated in controllers.
- Money values are generally stored as `{ value, currency }` pairs with `USD`/`KHR` as the two currencies; exchange-rate-aware arithmetic goes through `calculatePromotion`/`calculateService`/`calculatePaymentTotal` rather than inline math.
- Excel import/export (`exceljs` for export, `xlsx` for import) is a recurring pattern across resources (brand, product, category, etc.) — controllers implement `_import`/`_export` pairs following the same shape as `controllers/brandController.js`.
- `middleware/function/index.js` holds startup/maintenance-style middleware (e.g. `clearPendingTransaction`, which reverses stock for stale pending transactions).
- `models/` are plain Mongoose schemas, one file per collection, named to match the entity (PascalCase filenames, e.g. `ProductStock.js`, `LoanPayment.js`).

### Database bootstrap

`configs/db.js` connects to Mongo on startup and, if no `User` documents exist, seeds a default Super Admin role (all privileges from `roleMap.js` set to `true`), a default `Admin` user (password `Admin` + `DEFAULT_PASSWORD`), and empty `Store`/`StoreFloor`/`StoreSetting` documents. This only runs once, on an empty database.

### File uploads

`configs/multer.js` exposes two multer instances: `minioStorage` (streams directly to MinIO, for permanent uploads) and `memoryStorage` (in-memory buffer, used for things like Excel import where the file is parsed and discarded, not persisted). `routes/router.js` proxies `/uploads/:filename?bucket=&mimetype=` to read objects back out of MinIO, falling back to `uploads/default.png` if the object or bucket lookup fails.

### Scheduled/background work

`node-cron` is used in `controllers/notificationController.js` for scheduled notification checks.
