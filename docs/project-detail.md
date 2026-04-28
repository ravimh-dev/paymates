# Expense Splitter Project Detail

## 1. Project Summary

Expense Splitter is a backend-first shared-expenses platform. It is designed to help small groups record expenses, calculate who owes whom, and generate an optimized settlement plan that minimizes the number of transfers required to settle the group.

The current implementation is a modular monolith:
- Express handles HTTP routing
- Services hold business logic
- PostgreSQL stores all transactional data
- Redis caches frequently used read results
- EJS renders a lightweight demonstration UI

## 2. Product Goal

The project solves a common coordination problem:
- one person pays for a shared expense
- the cost must be split among multiple people
- each person's net balance must be tracked
- the system should recommend the smallest practical set of settlement transfers

The app reduces manual spreadsheet work and avoids human mistakes in split calculation and settlement planning.

## 3. Primary Users

- Friend groups
- Roommates
- Travel groups
- Small teams sharing operational costs

## 4. Runtime Architecture

### Request flow

1. A browser or API client sends a request.
2. Express applies security middleware, CORS, JSON parsing, compression, and request logging.
3. Routes forward the request to a controller.
4. The controller validates the request using `express-validator`.
5. The controller delegates the action to a service.
6. The service queries PostgreSQL and Redis.
7. The service returns data or throws an `AppError`.
8. The controller formats the response with the shared response helpers.
9. The centralized error middleware maps failures into consistent JSON responses.

### Design style

The project follows a controller-service-validation-route pattern:
- controllers are thin
- services own the domain behavior
- validation rules are separated into dedicated files
- route files bind the pieces together

## 5. Source Layout

### `src/`

- `src/app.ts`: Express application setup, middleware, routes, EJS views, static assets, and health endpoint.
- `src/server.ts`: bootstraps DB and Redis, starts the server, and installs process handlers.

### `db/`

- `db/index.ts`: PostgreSQL pool, Redis client, transaction helper, and cache helper functions.
- `db/tableschema.ts`: creates enums, tables, indexes, and triggers.
- `db/table-seed-data.ts`: inserts demo users, one demo group, and sample expenses.

### `modules/auth/`

- `auth.controller.ts`: register, login, refresh, logout, forgot password, reset password.
- `auth.service.ts`: token handling, password hashing, login checks, refresh rotation, password reset logic.
- `auth.validation.ts`: request validation chains.
- `auth.type.ts`: TypeScript models for auth inputs and outputs.
- `auth.route.ts`: binds auth endpoints.

### `modules/user/`

- `user.controller.ts`: profile fetch/update, password change, delete account.
- `user.service.ts`: profile lookup, update, password change, soft delete.
- `user.validation.ts`: validation chains for profile and password updates.
- `user.type.ts`: user data contracts.
- `user.route.ts`: binds user endpoints.

### `modules/groups/`

- `groups.controller.ts`: group CRUD, balances, members, invite, join.
- `groups.service.ts`: all group business logic, including cached reads and membership actions.
- `groups.validation.ts`: validation chains for group and member requests.
- `groups.type.ts`: group, member, summary, and balance types.
- `groups.route.ts`: binds group endpoints.

### `modules/expenses/`

- `expenses.controller.ts`: expense CRUD and list flow.
- `expenses.service.ts`: split computation, create/list/update/delete expense logic.
- `expenses.validation.ts`: validation chains for expense requests.
- `expenses.type.ts`: expense and split type definitions.
- `expenses.route.ts`: binds expense endpoints.

### `modules/settlements/`

- `settlements.controller.ts`: settlement plan, execute, history, and cancel endpoints.
- `settlements.service.ts`: settlement execution and history data access.
- `settlements.algorithm.ts`: greedy max-heap settlement algorithm.
- `settlements.validation.ts`: request validation for settlement APIs.
- `settlements.type.ts`: settlement plan and history types.
- `settlements.route.ts`: binds settlement endpoints.

### `middlewares/`

- `auth.middleware.ts`: authentication and group-role authorization.
- `error.middleware.ts`: operational error handling and fallback error formatting.

### `utils/`

- `constants.ts`: HTTP codes, roles, statuses, categories, cache keys, and epsilon.
- `response-generator.ts`: standard JSON response builders.

### `views/`

The EJS templates are minimal and mostly serve as a demo shell for the frontend scripts.

- `layouts/main.ejs`: shared HTML layout.
- `partials/`: header, footer, sidebar, and document head.
- `pages/login.ejs`: login and register page.
- `pages/dashboard.ejs`: user dashboard.
- `pages/group.ejs`: group detail and action screen.
- `pages/expense.ejs`: simple expense entry entry-point.
- `pages/settlement.ejs`: settlement plan and history screen.
- `pages/groups.ejs`: groups overview.
- `pages/balances.ejs`: across-group balances page.
- `pages/history.ejs`: history feed page.
- `pages/create-group.ejs`: dedicated group creation page.

### `public/`

- `public/js/app.js`: shared client utilities, API wrapper, auth state, formatting helpers, sidebar loading, and logout.
- `public/js/auth.js`: login/register page interactions.
- `public/js/dashboard.js`: dashboard statistics and create-group modal logic.
- `public/js/group.js`: group detail page behavior.
- `public/js/settlement.js`: settlement screen behavior.
- `public/js/history.js`: history screen behavior.
- `public/js/balances.js`: balances overview page behavior.
- `public/js/create-group.js`: standalone group creation form.

### `src/test/`

- `groups.service.test.js`
- `expenses.service.test.js`
- `middlewares.test.js`
- `test-cases.md`

These tests are mocked unit tests and do not write to the database.

## 6. Database Model

The database is PostgreSQL and uses UUID primary keys.

### Tables

- `users`
- `groups`
- `group_members`
- `expenses`
- `expense_splits`
- `settlements`
- `notifications`
- `audit_logs`

### Important relationships

- A user can create many groups.
- A group can have many members.
- A group can contain many expenses.
- An expense can have many split rows.
- A settlement belongs to one group and connects one debtor to one creditor.
- Audit logs store write activity across all entities.

### Schema behavior

- Soft delete is used for users, groups, and expenses.
- Partial indexes are used to speed up active record lookups.
- `group_members` includes `removed_at` so members can be re-added without losing prior state.
- `settlements` include `idempotency_key` to prevent duplicate writes.

## 7. Authentication Model

### Login flow

1. User submits email and password.
2. The backend validates the credentials.
3. bcrypt compares the password hash.
4. JWT access and refresh tokens are issued.
5. Refresh token is stored in the database and also set as an httpOnly cookie.

### Authorization

- Protected routes require a valid access token.
- Group mutations require the user to have the correct role in that group.
- The service layer uses group membership checks before mutating balances or expenses.

### Security practices

- bcrypt password hashing
- JWT-based authentication
- token rotation
- rate limiting
- Helmet security headers
- parameterized SQL queries
- centralized error handling

## 8. Business Logic

### Group balances

Balance is calculated as:

`balance = total_paid - total_owed`

Positive balance means the user is owed money.
Negative balance means the user owes money.

### Expense splitting

- Equal split: divide the amount among participants and assign the remainder to the last participant.
- Percentage split: validate that totals equal 100 percent within epsilon.
- Custom split: validate that split rows equal the expense amount within epsilon.

### Settlement engine

The engine:
- separates creditors and debtors
- picks the largest creditor and largest debtor
- emits one transfer at a time
- repeats until all balances are settled within epsilon

This greedy matching approach keeps the number of transactions low and runs in `O(n log n)` time.

## 9. Caching

Redis caches:
- user group lists
- group summaries
- group balances
- settlement plans

Cache invalidation happens after writes that change:
- expenses
- memberships
- group metadata
- settlements

## 10. API Surface

### Auth

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`

### Users

- `GET /api/users/me`
- `PUT /api/users/me`
- `POST /api/users/me/change-password`
- `DELETE /api/users/me`

### Groups

- `GET /api/groups`
- `POST /api/groups`
- `GET /api/groups/:groupId`
- `PUT /api/groups/:groupId`
- `DELETE /api/groups/:groupId`
- `GET /api/groups/:groupId/balances`
- `GET /api/groups/:groupId/invite`
- `GET /api/groups/join/:token`
- `POST /api/groups/:groupId/members`
- `DELETE /api/groups/:groupId/members/:userId`

### Expenses

- `POST /api/expenses`
- `GET /api/expenses`
- `GET /api/expenses/:expenseId`
- `PUT /api/expenses/:expenseId`
- `DELETE /api/expenses/:expenseId`

### Settlements

- `GET /api/settlements/plan/:groupId`
- `POST /api/settlements/execute`
- `GET /api/settlements/history/:groupId`
- `PATCH /api/settlements/:settlementId/cancel`

## 11. UI Behavior

The browser UI is intentionally minimal and serves as a demo shell.

### Pages

- login/register
- dashboard
- groups overview
- group detail
- balances overview
- settlement plan
- history feed
- create group
- expense entry entry-point

### Browser architecture

- `public/js/app.js` provides the shared API wrapper.
- Most UI pages use `requireAuth()` on the client side.
- The UI stores the access token in localStorage and uses it as a Bearer token for API calls.
- The refresh token is managed by cookies.

## 12. Testing

Current tests are mocked unit tests:
- service behavior
- middleware behavior
- error handling behavior

Current test count:
- 30 tests passing

Not yet present:
- route integration tests
- database integration tests
- browser automation tests

## 13. Known Gaps

The current codebase does not implement every feature from the original broad requirement:
- bulk import
- PDF export
- notification service
- true multi-tenant schema isolation beyond group-level separation

Those items can be added later if the requirement remains in scope.

## 14. Execution Flow

### Server startup

1. Load environment variables.
2. Connect to PostgreSQL.
3. Connect to Redis.
4. Start Express.
5. Register middleware, routes, and view rendering.

### Typical expense flow

1. User opens a group page.
2. Browser loads group, balances, expenses, settlement plan, and history.
3. User adds an expense.
4. Service validates membership and split data.
5. Expense and splits are written.
6. Relevant caches are cleared.
7. Group balances and settlement plan refresh.

### Typical settlement flow

1. User opens the settlement page.
2. Browser requests the group settlement plan.
3. Backend computes or returns a cached plan.
4. User executes a suggested payment.
5. Backend writes the settlement with idempotency checks.
6. Balances and settlement caches are invalidated.

## 15. Summary

This project is a solid backend-oriented financial workflow system with:
- a clear modular structure
- real transactional data handling
- a practical settlement algorithm
- a minimal but functional demo UI

The strongest parts are the service design, database modeling, and settlement logic. The most obvious next steps are broader test coverage, notification implementation, and closing the remaining feature gaps from the original requirement.
