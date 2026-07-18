# Frontend Integration Guide — Multi-Company / Multi-Store Scope

## Overview

This backend now supports a tenant hierarchy:

Customer -> Company -> Store

The frontend should maintain the active company and store selection in global state and include the values on every authenticated request.

## Required request headers

Every authenticated request must include:

- x-company-id
- x-store-id

Example:

```http
GET /organize/product
x-access-token: <token>
x-company-id: <companyId>
x-store-id: <storeId>
```

## Company selection flow

The frontend should:

1. Fetch companies for the logged customer
2. Allow the user to select a company
3. Store that selected companyId in app state
4. Use that companyId for the active session scope

## Store selection flow

The frontend should:

1. Fetch stores for the selected company
2. Allow the user to choose the active store
3. Save the selected storeId in app state
4. Use that storeId for all store-scoped requests

## Store-scoped resource behavior

The following resources must now be treated as store-isolated:

- Brand
- Category
- Product
- Stock
- Transaction
- Payment
- Reservation
- Loan
- Drawer
- Queue
- Promotion
- Notification
- Preset cash
- Store floor and store structure

## Important payload rule

When creating or updating store-scoped resources, the frontend should send:

```json
{
  "company": "<companyId>",
  "store": "<storeId>"
}
```

If the headers are already included, the backend can infer scope from them. The payload still remains useful for explicit client-side clarity.

## Backend helper behavior

The backend now exposes a tenant scope middleware that checks whether the logged-in user can access the selected scope.

If the user does not have access to the requested company/store scope, the API returns:

```json
{
  "msg": "You do not have access to this company/store scope."
}
```

## Recommended frontend app state shape

```ts
interface TenantScope {
  companyId: string | null
  storeId: string | null
}
```

Suggested state:

```ts
const tenantScope = {
  companyId: '',
  storeId: ''
}
```

## Recommended API client strategy

Wrap all API calls in an interceptor that injects:

```ts
headers: {
  'x-company-id': tenantScope.companyId,
  'x-store-id': tenantScope.storeId,
  'x-access-token': token
}
```

## Store switching UX recommendation

Use a standard company/store switcher in the UI:

- Company dropdown
- Store dropdown
- Switch immediately without logout
- Persist the last selected scope locally

## Notes for the frontend team

- Do not assume a single store exists globally.
- All product, stock, payment, reservation, and transaction lists should be filtered by the active store.
- Reports should be generated from the active store scope.
- Company is the parent grouping level; store is the actual operating unit.

## Backend route additions

New company endpoints:

- GET /organize/company
- GET /organize/company/list
- GET /organize/company/detail/:id
- POST /organize/company/create
- PUT /organize/company/update/:id
- DELETE /organize/company/disable/:id

## Endpoint status

- Company hierarchy scaffold: implemented
- Store scope middleware: implemented
- Catalog scope enforcement: partially implemented
- Sales scope enforcement: partially implemented
- Full end-to-end tenant isolation across all business records: next phase
