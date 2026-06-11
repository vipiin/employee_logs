# Employee Management System

A full-stack, event-driven Employee Management application built with **Spring Boot**, **Angular**, **Neon PostgreSQL**, **Apache Kafka**, and **Resilience4j**.

## Features & Core Mechanics

### 1. Gmail-Style Transaction Deferral (Undo Option)
To provide a premium and highly responsive user experience, all write operations (Create, Update, and Delete) are deferred on the client-side for **5 seconds** before being sent to the database.

* **Optimistic UI Rendering**: When a user clicks Delete, submits a new employee, or updates an existing employee, the list UI updates immediately to reflect the change.
* **Temporary IDs**: During a creation deferral, the employee is given a temporary ID of `-1`. To ensure data integrity, action buttons (Update, Delete, View) are disabled for rows with negative IDs until the record is successfully committed.
* **State Rollback**: A floating Toast Notification appears in the bottom-right corner with a 5-second countdown timer. If the user clicks **Undo**:
  * The timeout is cancelled.
  * The list state reverts (removes temporary rows, restores original attributes for updates, or inserts back deleted rows).
  * No HTTP requests are sent to the backend.
* **Auto-Commit Safety Hooks**: To prevent data loss, the action is forced to commit immediately if:
  * The countdown timer reaches 0.
  * The user clicks "Dismiss" on the Toast.
  * The user navigates away (Angular `ngOnDestroy` hook).
  * The user reloads the page or closes the tab (registered via `@HostListener('window:beforeunload')`).
* **Refresh Protection**: The custom router navigation states are cleared from `window.history` immediately after retrieval to prevent duplicate toast messages upon page refreshes.

---

### 2. Resilience4j API Rate Limiting & Countdown Clocks
To prevent server abuse and ensure API availability, a sliding-window rate limiter is integrated on the `/api/v1/employees` endpoint.

* **Backend Throttling**: Configure a limit of **5 requests per minute** using Resilience4j RateLimiter. Throttled requests immediately return a `429 Too Many Requests` status code.
* **Exposed Metrics Headers**: Every request returns standard headers detailing limit stats:
  * `X-RateLimit-Limit`: Maximum requests permitted per period (5).
  * `X-RateLimit-Remaining`: Available request credits in the current cycle.
  * `X-RateLimit-Reset-Seconds`: Seconds remaining until the rate-limiter resets.
* **Drift-Immune Frontend Timer**: The client calculates the absolute end of the rate limiter cycle (`Date.now() + resetSeconds * 1000`) on response. It runs a countdown interval matching this absolute time, keeping the UI timer accurate and immune to browser tab background sleep delays.
* **Graceful Fallbacks**: If rate-limited, the application displays a danger alert informing the user how many seconds they must wait before retrieving employee records again.

---

### 3. Kafka & Server-Sent Events (SSE) Real-Time Pipeline
The system uses an event-sourcing approach to sync updates and logs across the stack in real-time.

* **Kafka Publisher**: When an employee is created, updated, or deleted on the database, the backend publishes an event (e.g., `EMPLOYEE_CREATED`, `EMPLOYEE_UPDATED`, `EMPLOYEE_DELETED`) to the `employee-events` Kafka topic.
* **SSE Emitter**: The Spring Boot backend listens to the Kafka topic and propagates messages to connected clients via a Server-Sent Events (SSE) stream (`/api/events`).
* **Event Log Feed**: The Angular frontend connects to the SSE stream and displays a running log of the last 5 operations in a "Kafka Event Pipeline" sidebar.
* **Visual Row Highlights**: Upon receiving an event, the corresponding row in the employee list is highlighted using CSS animations (Green for Created, Blue for Updated) for 3 seconds to draw the user's attention to external database updates.

---

## Tech Stack

* **Frontend**: Angular, RxJS, Bootstrap, HTML5/CSS3.
* **Backend**: Spring Boot, Spring Web, Spring Data JPA, Hibernate, Resilience4j.
* **Database**: Neon PostgreSQL (Serverless Cloud DB).
* **Messaging**: Apache Kafka.

---

## Project Setup

### Backend (Spring Boot)
1. Ensure a PostgreSQL instance is running and update credentials in `springboot-backend/src/main/resources/application.properties`.
2. Ensure an Apache Kafka server is active on `localhost:9092`.
3. Navigate to the backend directory:
   ```bash
   cd springboot-backend
   ```
4. Build and run the Spring Boot application:
   ```bash
   ./mvnw spring-boot:run
   ```

### Frontend (Angular)
1. Navigate to the frontend directory:
   ```bash
   cd angular-frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm start
   ```
4. Open your browser and navigate to `http://localhost:4200/`.

---

## Deployment & Notes
* **Backend Status**: Deployed on Render.
* **Render Warm-up**: Render backend services may spin up in about 1 minute after cold starts.
* **PostgreSQL Database**: Postgres database expires on December 13.
