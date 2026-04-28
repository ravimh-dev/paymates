# Expense Splitter

Expense Splitter is a backend-first shared-expenses platform for groups that need to track spending, calculate balances, and settle debts with the fewest possible transfers. It combines a modular Node.js/TypeScript backend, PostgreSQL, Redis, and a lightweight EJS demo UI to deliver a practical full-stack workflow.

## Overview

- Track shared expenses across groups of friends, roommates, or teams
- Compute who owes whom using deterministic balance calculations
- Generate optimized settlement plans with a heap-based matching algorithm
- Provide a minimal browser UI for common user flows
- Expose a documented REST API for frontend and API clients

## Architecture

The application follows a modular monolith design:

- `src/app.ts` configures Express, security middleware, static assets, routes, and error handling
- `src/server.ts` connects PostgreSQL and Redis before starting the server
- `modules/` contains controller, service, validation, route, and type files for each domain, including auth, user, groups, expenses, settlements, and notifications
- `db/` contains the connection layer, schema setup, and seed data
- `public/js/` contains browser-side API calls and page behavior
- `views/` contains EJS pages for the demo UI

Request flow:

`UI or API client -> Express route -> validation -> controller -> service -> PostgreSQL / Redis -> response`

## Tech Stack

| Layer         | Technology                  |
| ------------- | --------------------------- |
| Runtime       | Node.js                     |
| Language      | TypeScript                  |
| Web Framework | Express.js                  |
| Database      | PostgreSQL                  |
| Cache         | Redis                       |
| Views         | EJS                         |
| Auth          | JWT, bcrypt                 |
| Validation    | express-validator           |
| Logging       | Pino, Morgan                |
| Security      | Helmet, CORS, rate limiting |
| Testing       | Jest                        |

## Key Capabilities

- JWT-based authentication with refresh tokens and logout support
- User profile management with password change and soft delete
- Group CRUD, membership management, invite links, and role-based access control
- Expense creation with equal, percentage, and custom splits
- Bulk expense import from CSV/TSV-style data
- Settlement planning and execution with idempotency protection
- PDF export for settlement reports
- In-app notifications for invites, expense updates, and settlement reminders
- Redis caching for frequently used group, balance, and settlement data
- Centralized validation and consistent API error handling
- Jest-based unit tests for core service and middleware logic

## Project Structure

```text
project-root/
src/                 # App bootstrap and server startup
db/                  # PostgreSQL schema, seed, and DB/Redis helpers
modules/             # Auth, user, groups, expenses, settlements, notifications
middlewares/         # Auth and error handling
utils/               # Shared constants and response helpers
views/               # EJS demo pages and partials
public/              # Browser JavaScript and CSS
docs/                # Project detail, OpenAPI, and Postman exports
src/test/            # Jest unit tests
```

## Setup

### Prerequisites

- Node.js 20 or newer
- PostgreSQL 15 or newer
- Redis 7 or newer

### Install Dependencies

```bash
npm install
```

### Configure Environment

- Copy `.env.sample` to `.env`
- Update database, Redis, JWT, and SMTP values
- `DB_URL` takes precedence over `DB_HOST`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD`

### Initialize Database

```bash
npm run db:setup
npm run db:seed
```

### Development

```bash
npm run dev
```

### Production

```bash
npm run build
npm start
```

### Tests

```bash
npm test
```

## API Summary

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
- `GET /api/settlements/:groupId/export/pdf`

### Notifications

- `GET /api/notifications`
- `GET /api/notifications/unread-count`
- `PATCH /api/notifications/read-all`
- `PATCH /api/notifications/:notificationId/read`

## Demo Pages

- `/login`
- `/dashboard`
- `/groups`
- `/groups/create`
- `/groups/:id`
- `/balances`
- `/history`
- `/settlements`
- `/settlements/:groupId`
- `/notifications`
- `/profile`
- `/join/:token`
- `/reset-password`

## Security

- Passwords are hashed with bcrypt
- Auth uses JWT access and refresh tokens
- Refresh tokens are stored server-side for revocation
- Sensitive routes use authentication middleware
- Group actions enforce role-based access control
- Requests are validated with express-validator
- SQL queries use parameterized statements
- Rate limiting and Helmet reduce common abuse vectors

## Performance and Reliability

- Redis caches group summaries, balances, and settlement plans
- Settlement calculation uses a greedy heap-based algorithm with `O(n log n)` complexity
- Balance calculations ignore tiny floating-point noise with epsilon handling
- Database writes use transactions where needed
- Soft deletes preserve history and avoid destructive loss

## Testing

The current test suite is focused on mocked unit tests:

- Auth service tests
- User service tests
- Group service tests
- Expense service tests
- Import service tests
- Notification service tests
- PDF builder tests
- Middleware tests

Current status:

- 46 passing Jest tests
- 8 passing test suites
- No database writes during test execution

## Documentation

- Project detail: [docs/project-detail.md](docs/project-detail.md)
- Swagger/OpenAPI: [docs/openapi.yaml](docs/openapi.yaml)
- Postman collection: [docs/postman_collection.json](docs/postman_collection.json)

## Known Limitations

- Spreadsheet-native `.xlsx` upload support can still be added later
- Notification delivery is currently in-app plus SMTP when configured
- Frontend is intentionally minimal and focused on demonstrating API flows

## Notes

- The demo UI is designed to be functional rather than feature-complete
- The app is backend-first and API-driven
- The source tree is organized for incremental growth without changing the main stack
