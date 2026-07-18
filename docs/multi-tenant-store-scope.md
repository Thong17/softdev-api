# Multi-Company / Multi-Store Scope Design

## Goal

Support one customer owning multiple companies and each company containing multiple stores. Every store-scoped business object must be isolated to its own store and company.

## Hierarchy

Customer -> Company -> Store

## New backend objects

### Company

Path: /organize/company

Fields:
- name (object)
- legalName
- status
- contact
- email
- address
- logo
- stores[]
- isDeleted
- createdBy

### UserStoreAccess

Purpose:
- allow a user to access a specific company + store
- store role assignment per scope

Fields:
- user
- company
- store
- role
- isDeleted

## Tenant request scope

The API now supports the following scope headers:
- x-company-id
- x-store-id

Recommended frontend behavior:
- store selected companyId and storeId in global state
- attach the values to every authenticated request
- keep a fallback to the user’s last selected scope

## Store model changes

The Store model now includes:
- company

This allows one store to belong to one company.

## Middleware behavior

The new `scopeTenant` middleware checks whether the logged-in user has access to the target company/store scope before allowing the request to continue.

If access is missing, the API returns:
- 403 Forbidden
- message: You do not have access to this company/store scope.

## Frontend integration checklist

### 1. Company selection
The frontend should support:
- list companies for the current customer
- select a company
- store the selected company in app state

### 2. Store selection
The frontend should support:
- list stores inside the selected company
- select one active store
- switch between stores without re-login

### 3. Every authenticated request
Every request should send:
- x-company-id
- x-store-id

### 4. Data isolation
All store-scoped tables should follow this rule:
- companyId must be included on every business record
- storeId must be included on every business record
- queries must filter by the selected store scope

## Recommended model update plan

The following models should eventually receive the same tenant scoping:
- Product
- Category
- Brand
- ProductStock
- Transaction
- Payment
- Reservation
- Loan
- Drawer
- Queue
- Promotion
- Notification
- PresetCash
- StoreFloor
- StoreStructure
- User / Profile / Config are global, not store-owned

## Recommended API contract

### Company endpoints
- GET /organize/company
- GET /organize/company/list
- GET /organize/company/detail/:id
- POST /organize/company/create
- PUT /organize/company/update/:id
- DELETE /organize/company/disable/:id

### Store endpoints
- Existing store endpoints remain valid
- Store create/update should now require `company`

## Notes

This backend scaffold is the first phase. To fully close the feature, the existing operational models still need the `company` and `store` ownership fields applied consistently before the system is truly multi-tenant.
