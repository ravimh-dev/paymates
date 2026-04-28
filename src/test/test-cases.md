# Expense Splitter Test Cases

This folder is documentation only.

It does not execute tests, seed data, or write any records to the database.

## Test Case Format

| Field | Description |
|---|---|
| Test Case ID | Unique identifier for the scenario |
| Module | Feature area being verified |
| Scenario | What is being tested |
| Preconditions | Required state before execution |
| Test Data | Sample input values |
| Steps | Manual or automated steps to follow |
| Expected Result | Correct system behavior |
| Priority | High, Medium, or Low |

## Test Cases

| Test Case ID | Module | Scenario | Preconditions | Test Data | Steps | Expected Result | Priority |
|---|---|---|---|---|---|---|---|
| AUTH-001 | Authentication | Register a new user with valid details | User does not already exist | Name: Alice, Email: alice@example.com, Password: Password@123 | Open register page, submit form with valid values | Account is created and user is redirected or shown success message | High |
| AUTH-002 | Authentication | Register with duplicate email | Existing user with same email is present | Email: alice@example.com | Submit registration using an existing email | Validation error is shown and no account is created | High |
| AUTH-003 | Authentication | Register with weak password | None | Password: 12345 | Submit registration with weak password | Password policy error is shown | High |
| AUTH-004 | Authentication | Login with valid credentials | User account exists and is active | Email: alice@example.com, Password: Password@123 | Submit login form | User is authenticated and session/token is created | High |
| AUTH-005 | Authentication | Login with wrong password | User account exists | Email: alice@example.com, Password: WrongPass1 | Submit login form | Login fails with an invalid credentials message | High |
| AUTH-006 | Authentication | Access protected route without token | User is not authenticated | None | Open any protected route or API | Request is rejected with unauthorized response or redirect to login | High |
| AUTH-007 | Authentication | Logout current session | User is logged in | Current active session | Click logout | Session/token is cleared and user is logged out | Medium |
| USER-001 | User Profile | View own profile | User is logged in | None | Open profile page | Profile details are displayed correctly | Medium |
| USER-002 | User Profile | Update profile name | User is logged in | New name: Alice Sharma | Edit profile and save | Name is updated and reflected across UI | Medium |
| USER-003 | User Profile | Update profile with invalid email format | User is logged in | Email: alice@invalid | Save profile | Validation error is shown | Medium |
| GROUP-001 | Groups | Create a group with valid details | User is logged in | Name: Goa Trip 2024, Currency: INR | Submit create group form | Group is created successfully and creator becomes admin | High |
| GROUP-002 | Groups | Create a group with missing name | User is logged in | Name: blank | Submit create group form | Validation error is shown and group is not created | High |
| GROUP-003 | Groups | List all groups for logged-in user | User is a member of one or more groups | None | Open groups page or call group list endpoint | Only the user’s active groups are displayed | High |
| GROUP-004 | Groups | Open group details as a member | User belongs to the group | Valid group ID | Open group page | Group summary, members, and expenses load correctly | High |
| GROUP-005 | Groups | Open group details as a non-member | User is logged in but not in the group | Valid group ID | Open group page directly | Access is denied or hidden with not-found style response | High |
| GROUP-006 | Groups | Update group name as admin | User is group admin | New group name | Save updated group settings | Group name changes successfully | High |
| GROUP-007 | Groups | Update group name as non-admin | User is group member only | New group name | Attempt group update | Request is rejected with permission error | High |
| GROUP-008 | Groups | Add member by email | User is group admin and target user exists | Email: bob@example.com, Role: member | Submit add-member action | Member is added to the group successfully | High |
| GROUP-009 | Groups | Add member with unknown email | User is group admin | Email: unknown@example.com | Submit add-member action | Error is shown that user was not found | Medium |
| GROUP-010 | Groups | Remove member with zero balance | User is group admin and member has no open balance | Target member ID | Remove the member | Member is removed successfully | High |
| GROUP-011 | Groups | Remove member with outstanding balance | User is group admin and member has open balance | Target member ID with balance | Remove the member | Operation is blocked with conflict or balance warning | High |
| GROUP-012 | Groups | Join group using valid invite token | Invite token is active | Valid invite token | Open invite link or submit token | User joins the group successfully | High |
| GROUP-013 | Groups | Join group using expired token | Invite token is expired | Expired token | Open invite link or submit token | Request fails with invalid or expired invite error | High |
| EXP-001 | Expenses | Create equal split expense | User is group member | Amount: 4000, Paid by: Alice, Split: equal | Submit expense form | Expense is created and equal split entries are generated correctly | High |
| EXP-002 | Expenses | Create custom split expense | User is group member | Amount: 1500, Split values: 500, 500, 250, 250 | Submit expense form | Expense is created and split amounts match the custom values | High |
| EXP-003 | Expenses | Create percentage split expense | User is group member | Percentages: 40, 30, 20, 10 | Submit expense form | Percentages are validated and split totals equal 100 percent | High |
| EXP-004 | Expenses | Create expense with invalid amount | User is group member | Amount: 0 or negative | Submit expense form | Validation error is shown | High |
| EXP-005 | Expenses | Create expense paid by non-member | User is group member but payer is not in group | Paid by: external user | Submit expense form | Request is rejected because payer is not a group member | High |
| EXP-006 | Expenses | View expense details | Expense exists in group | Valid expense ID | Open expense detail page | Description, payer, splits, and totals are displayed correctly | Medium |
| EXP-007 | Expenses | Edit expense by creator | User is authorized to update expense | Updated description or amount | Save expense changes | Expense is updated and balances are recalculated | High |
| EXP-008 | Expenses | Delete expense by unauthorized user | User is not allowed to delete expense | Valid expense ID | Attempt delete | Operation is rejected with permission error | High |
| EXP-009 | Expenses | Delete expense and verify split cleanup | User is authorized to delete expense | Valid expense ID | Delete expense | Expense is soft-deleted or removed and related split visibility updates correctly | High |
| BAL-001 | Balances | View group balances | User is a group member | Valid group ID | Open balances view | Balances are calculated and displayed for all active members | High |
| BAL-002 | Balances | Verify balance after expense creation | Group has new expense | Example expense with multiple splits | Refresh balances view | Balances reflect the latest expense totals | High |
| BAL-003 | Balances | Verify zero balance state | All expenses are settled | None | Open balances view | All members show zero or near-zero balance | Medium |
| SET-001 | Settlements | Generate settlement plan | Group has outstanding balances | Valid group ID | Open settlement planner | Optimal plan is generated with minimum transactions | High |
| SET-002 | Settlements | Execute a settlement | User is group member and settlement is valid | From user, to user, amount | Submit settlement | Settlement is recorded and balances update | High |
| SET-003 | Settlements | Execute settlement with insufficient permission | User is not allowed | Valid settlement payload | Submit settlement | Request is denied | High |
| SET-004 | Settlements | Cancel pending settlement | Settlement exists in pending state | Settlement ID | Click cancel | Settlement status changes to cancelled | Medium |
| SET-005 | Settlements | View settlement history | Group has past settlements | Valid group ID | Open history page | Past settlements are listed in reverse chronological order | Medium |
| ERR-001 | Error Handling | Load non-existent group | Group ID does not exist | Invalid group ID | Open group details route | User sees a not-found message or 404 response | High |
| ERR-002 | Error Handling | Submit malformed API payload | API request body is invalid JSON or missing fields | Partial request body | Send request to create expense or group | Server returns validation error, not crash | High |
| ERR-003 | Error Handling | Database connection unavailable | PostgreSQL is stopped or unreachable | None | Open protected pages or API routes | Server surfaces a controlled error state, not an uncaught crash | High |
| SEC-001 | Security | Prevent unauthorized access to another user’s group | User is logged in as a different user | Another user’s group ID | Open route directly | Access is blocked | High |
| SEC-002 | Security | Prevent SQL injection style input | User submits suspicious characters | Input containing quotes and SQL fragments | Submit forms with crafted input | Input is treated as data and rejected or safely stored | High |
| SEC-003 | Security | Expired JWT access token | User token is expired | Expired token | Call protected endpoint | Request is rejected and re-authentication is required | High |
| UI-001 | Views | Render dashboard page successfully | User is logged in | None | Open dashboard | Dashboard loads without broken assets or console errors | Medium |
| UI-002 | Views | Render login page successfully | None | None | Open login page | Login form renders with all controls visible | Medium |
| UI-003 | Views | Render groups page with empty state | User has no groups | None | Open groups page | Empty state message and action to create/join are shown | Medium |
| UI-004 | Views | Render group page with members and expenses | User belongs to a populated group | Valid group ID | Open group page | Members list, expenses list, and summary sections render correctly | High |
| UI-005 | Views | Render settlement page | Group has settlement data | Valid group ID | Open settlement page | Settlement plan and history sections load correctly | Medium |

## Suggested Execution Order

1. Authentication and access control.
2. Group creation and membership flows.
3. Expense creation and balance recalculation.
4. Settlement generation and execution.
5. Error handling and security edge cases.
6. UI rendering and empty-state checks.

## Notes

- Use seeded or mocked data in a test environment only.
- Do not run these scenarios against production data.
- Do not insert records into the live database unless you intentionally run a seed or integration test workflow.
