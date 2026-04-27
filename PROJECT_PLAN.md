# Project Plan: Stream Donation Platform

## Project Path
- `C:\Users\tgkru\Documents\New project`

## Base Reference
- GitHub base: `calc1f4r/Buy-me-a-Coffee`
- Dashboard UX reference: `TikFinity`
- Widget reference: `DonationAlerts last donations`

## Product Goal
Build a donation website and streamer dashboard with:
- a polished public donation page
- stream-specific modes and actions
- crypto and Monobank payment flows
- TikTok-style gift automation
- fake donation tools and stream widgets
- Minecraft and streamer integrations from one dashboard

## Core Product Modules

### 1. Public Donation Site
- Landing page based on the visual idea of `Buy-me-a-Coffee`
- Strong hero section
- Quick amount selection
- Payment methods:
  - wallet connect
  - CryptoBot
  - Monobank jar
- Stream mode tabs at the top

### 2. Stream Modes
- `Normal donation`
- `TikTok`
- custom streamer-defined modes
- `Fake donations`

### 3. Streamer Dashboard
- TikFinity-like control panel
- stream management
- gift and action mapping
- connection settings
- widget settings
- fake donation scenarios

### 4. Action Engine
- event -> rule -> action pipeline
- queue execution
- cooldowns
- retries
- logs

### 5. Widget System
- last donations list
- top 3 donors
- fake donation battle widget
- alert overlay support

## Mode Visibility Rules
- `Normal donation` is always visible and always enabled
- All other modes are controlled by dashboard checkboxes
- Only enabled modes appear as tabs on the public donation page
- If all optional modes are disabled, only `Normal donation` is shown
- Empty or unavailable tabs must never be rendered

## Public Donation Page Behavior

### Top Navigation Tabs
- Tabs are shown at the top of the page
- Available tabs depend on current stream settings
- The selected tab changes visible content and actions

### Normal Donation Mode
- Standard support page
- quick donate amounts
- custom amount
- message field
- payment method selection

### TikTok Mode
- Shows actions tied to live gifts or custom paid actions
- Lets viewers choose action quantity
- Calculates price automatically
- Creates a temporary payment check

### Custom Stream Modes
- Streamer defines the tab name manually
- Each mode can have its own actions, prices, and layout

### Fake Donations Mode
- Separate tab on the public page only if enabled
- Shows fake donation feed and related widgets if streamer wants it public
- Can also stay dashboard-only if configured private

## Stream Setup Model
Each stream has its own configuration:
- stream title
- slug
- active status
- enabled modes
- visible widgets
- payment methods
- action list
- cooldowns
- check settings
- theme overrides

## Payment Methods

### Wallet Connect
- Support donation through connected crypto wallet
- Assets:
  - USDT
  - TON
  - Litecoin
- Allow preset and custom amounts

### CryptoBot
- Create invoice links
- Track invoice status via webhook
- Mark order as paid on confirmation

### Monobank Jar
- Personal flow without FOP
- Create unique order code for each attempt
- Ask user to include code in payment comment
- Match incoming payment using:
  - amount
  - code in comment
  - timestamp
  - sender name if available

## Check System

### Goal
Reserve a payment request for a specific action and prevent collisions.

### Rules
- A check is created for a concrete action request
- Check lifetime is `10 minutes`
- The same final amount cannot be reserved again while an active check exists
- If an amount is blocked, the user sees:
  - this amount is already reserved
  - choose another quantity or wait until the check expires

### Per-User Limits
- One user can have at most `3 active checks`
- User must:
  - pay the check
  - cancel the check
  - or wait for expiration

### Check Flow
1. User opens a stream page
2. User chooses mode
3. User selects action and quantity
4. System calculates amount
5. System validates collisions and user limits
6. System creates a 10-minute check
7. User pays via selected method
8. Payment confirmation marks check as paid
9. Paid check creates action queue
10. Queue executes commands

## Action Execution Engine

### Supported Action Types
- Minecraft command
- RCON command
- button press or macro
- webhook call
- OBS action
- sound alert
- overlay alert
- chat message

### Queue Rules
- Every paid order becomes an action queue
- Repeated actions execute with `0.1s` delay between steps
- Example:
  - `spawn zombie x100`
  - run 100 queued executions
  - wait `0.1s` between each execution

### Safety Rules
- Validate command templates before execution
- Use rate limiting and cooldowns
- Add emergency stop
- Do not allow raw unsafe commands without explicit enablement

## TikTok Gifts Strategy

### Goal
Have a fast TikFinity-like gift mapping system without depending on one huge manual JSON file.

### Recommended Approach
- Use database as the source of truth
- Keep JSON only for import/export and backups

### Gift Catalog Logic
- Maintain a `tiktok_gifts` table
- Seed known gifts initially if available
- When a new gift event arrives:
  - if gift exists, update last seen time
  - if gift does not exist, create it automatically
- Store:
  - platform gift id
  - display name
  - coin price
  - image if available
  - first seen timestamp
  - last seen timestamp

### Why Not Pure JSON
- Slower to search and update
- Harder to bind gifts to rules
- Worse for dashboard filtering
- Worse for automatic discovery of new gifts

## Fake Donations Module

### Goal
Create a DonationAlerts-like system for simulated donations, overlays, widgets, and fake battles.

### Features
- fake donation creation
- fake donor profiles
- fake donation templates
- donation list feed
- donation settings
- overlay widget configuration
- top donor widgets
- battle mode between fake donors

### Fake Donation Feed
- Store all fake donations in a separate table
- Display them in a list similar to `DonationAlerts last donations`
- Show:
  - donor name
  - amount
  - message
  - type
  - timestamp

### Fake Donation Settings
- default currency
- min and max amount
- default message templates
- avatar support
- public/private visibility
- widget style settings

### Fake Battle Mode
- Create battle between two or more fake donors
- Example:
  - Nastya vs Vlad
- System generates donations alternately
- Interval range:
  - every `N1` to `N2` minutes
- Amount range:
  - configurable min and max
- Updates leaderboard in real time

### Top Donors Widget
- Display top 3 donors as a list
- Works with:
  - real donations only
  - fake donations only
  - combined mode

### Widget Types
- last donations
- top 3 donors
- battle status
- alert popup
- ticker or scrolling list

## Dashboard Structure

### 1. Overview
- live connection status
- active stream
- recent events
- recent donations
- quick actions

### 2. Streams
- create stream
- edit stream
- enable or disable modes
- control public tab visibility
- choose theme and widgets

### 3. Actions
- create paid actions
- set price
- set currency
- set command template
- set quantity behavior
- set cooldown

### 4. TikTok Gifts
- searchable catalog
- auto-discovered gifts
- map gift to action
- import/export mappings

### 5. Fake Donations
- create fake donors
- create fake donations
- configure fake battles
- manage widgets and feed

### 6. Widgets
- last donations widget
- top 3 donors widget
- battle widget
- alert widget
- overlay URLs and settings

### 7. Connections
- Twitch username and settings
- TikTok username and settings
- Minecraft server settings
- RCON settings
- OBS settings
- CryptoBot settings
- Monobank settings

### 8. Hotkeys
- in-app shortcuts
- quick trigger actions
- pause queue
- resume queue
- emergency stop
- conflict detection

### 9. Logs
- incoming events
- payment checks
- payment confirmations
- executed commands
- failures and retries

### 10. Settings
- streamer profile
- branding
- defaults
- safety rules
- export/import

## Streamer Profile and Integrations

### Profile Fields
- streamer display name
- Twitch username
- TikTok username
- default mode
- default currency
- theme settings

### Minecraft and RCON
- server host
- server port
- RCON enabled
- RCON password
- connection test
- allowed command templates

### Hotkey Strategy
- browser-level shortcuts for MVP
- optional local companion app later for global hotkeys

## Suggested Data Model

### Main Tables
- `users`
- `streams`
- `stream_modes`
- `payment_methods`
- `actions`
- `action_rules`
- `check_orders`
- `payment_events`
- `action_queues`
- `action_queue_steps`
- `tiktok_gifts`
- `gift_mappings`
- `connections`
- `fake_donors`
- `fake_donations`
- `fake_battles`
- `widgets`
- `widget_instances`
- `event_logs`

### Important Table Notes
- `check_orders` stores pending, paid, expired, canceled checks
- `action_queue_steps` stores one execution per repeated unit
- `tiktok_gifts` is auto-updated when unknown gifts are seen
- `fake_battles` stores participant order, timing, and amount rules

## Recommended Tech Direction
- Start from `Buy-me-a-Coffee` if the stack is clean enough
- Keep the public site and dashboard in one app if possible
- Use a database from day one
- Suggested first fast option:
  - `Next.js`
  - `TypeScript`
  - `SQLite` for local MVP
  - `Prisma` or equivalent ORM
- Move to Postgres later if scale requires it

## Phased Implementation Plan

### Phase 0. Project Bootstrap
Goal:
- get a working local base into the repo

Tasks:
1. Clone or copy the `calc1f4r/Buy-me-a-Coffee` repository into the project folder
2. Install dependencies
3. Run the project locally
4. Remove unused demo pieces
5. Confirm current stack, routes, and data flow

Deliverables:
- running local app
- cleaned starting point
- short architecture notes

### Phase 1. Core Refactor and Foundation
Goal:
- prepare the app to support both public page and dashboard

Tasks:
1. Define route structure
2. Add database and schema
3. Add shared config system
4. Add environment variable handling
5. Add base UI layout system
6. Add authentication plan for dashboard

Deliverables:
- stable app skeleton
- schema for core entities
- base layout for public site and dashboard

### Phase 2. Public Donation Page Rebuild
Goal:
- redesign the landing page and support mode tabs

Tasks:
1. Replace starter UI with custom design
2. Add hero section and quick amounts
3. Add top tabs for modes
4. Enforce mode visibility rules
5. Add payment method cards
6. Add responsive layout and visual polish

Deliverables:
- finished public landing page
- dynamic tabs based on enabled modes

### Phase 3. Stream Management
Goal:
- let streamer create streams and control available modes

Tasks:
1. Build stream CRUD
2. Add per-stream mode toggles
3. Add stream theme and widget settings
4. Add public slug or route per stream

Deliverables:
- stream setup page
- dynamic public stream page

### Phase 4. Actions and Check Orders
Goal:
- create the core monetized action system

Tasks:
1. Build action catalog
2. Add action price and quantity settings
3. Add check creation logic
4. Add 10-minute expiration
5. Add same-amount collision blocking
6. Add 3 active checks per user limit
7. Add cancel flow

Deliverables:
- working check system
- action requests with reservation rules

### Phase 5. Payment Integrations
Goal:
- connect real payment flows

Tasks:
1. Add wallet connect flow
2. Add CryptoBot invoice creation
3. Add CryptoBot webhook handling
4. Add Monobank code generation
5. Add Monobank personal webhook handling
6. Add payment matching service

Deliverables:
- paid checks become confirmed orders
- payment status tracked end to end

### Phase 6. Action Queue Engine
Goal:
- execute paid actions safely

Tasks:
1. Build queue service
2. Split repeated actions into queue steps
3. Add `0.1s` delay support
4. Add execution logs
5. Add retry and failure handling
6. Add emergency stop

Deliverables:
- live execution engine
- safe command queue

### Phase 7. Dashboard MVP
Goal:
- create the TikFinity-like dashboard shell

Tasks:
1. Build left-side navigation
2. Add Overview page
3. Add Streams page
4. Add Actions page
5. Add Connections page
6. Add Logs page

Deliverables:
- usable dashboard with core pages

### Phase 8. TikTok Gifts Catalog and Mapping
Goal:
- support gift-based automation with fast gift discovery

Tasks:
1. Add `tiktok_gifts` table
2. Add searchable gift UI
3. Add gift mapping to actions
4. Add unknown gift auto-create logic
5. Add import/export JSON

Deliverables:
- TikTok gift catalog
- mapping workflow similar to TikFinity

### Phase 9. Minecraft, RCON, and Hotkeys
Goal:
- connect in-game actions and live controls

Tasks:
1. Add Minecraft settings page
2. Add RCON connection test
3. Add command validation
4. Add browser hotkeys
5. Add queue control shortcuts

Deliverables:
- connected game integration
- quick live control tools

### Phase 10. Fake Donations and Widgets
Goal:
- build simulated donation tools and stream widgets

Tasks:
1. Add fake donors
2. Add fake donation feed
3. Add fake donation settings
4. Add last donations widget
5. Add top 3 donors widget
6. Add alert widget
7. Add battle mode
8. Add random interval donation generator

Deliverables:
- DonationAlerts-style fake donation system
- working widget URLs

### Phase 11. Polish and Optimization
Goal:
- make the platform stable, fast, and pleasant to use

Tasks:
1. Optimize queries and page loads
2. Improve dashboard UX
3. Add empty states and warnings
4. Add better logging
5. Add backups and export tools
6. Test all stream flows

Deliverables:
- production-shaped MVP
- cleaner UX and fewer failure points

## AI Agent Execution Notes
- Build in the exact phase order above
- Do not start payment integrations before checks and data model exist
- Do not start live action execution before safety controls exist
- Use database, not a giant static JSON file, for gifts and rules
- Keep JSON only for import/export and backups
- Treat fake donations as a separate module from real payments
- Keep `Normal donation` permanently enabled on the public page

## First Practical Next Step
Start with:
1. download or clone the GitHub base
2. inspect the stack
3. clean the starter app
4. prepare schema and route architecture

