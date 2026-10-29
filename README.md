# 🏙️ CivicLens AI

<div align="center">

### SEE THE ISSUE. MAP THE PROBLEM. TRACK THE CHANGE.

**An AI-assisted civic issue reporting and resolution platform.**

CivicLens AI empowers residents to report local infrastructure problems, visualize issues on an interactive map, and follow their progress toward resolution. Staff can review submissions, prioritize cases, coordinate action, and document outcomes with photographic evidence.

**From street-level problems to data-driven civic action.**

![Project](https://img.shields.io/badge/PROJECT-CIVIC%20TECH-0F766E?style=for-the-badge)
![AI](https://img.shields.io/badge/AI-PyTorch-EE4C2C?style=for-the-badge&logo=pytorch&logoColor=white)
![Backend](https://img.shields.io/badge/BACKEND-FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![Database](https://img.shields.io/badge/DATABASE-PostgreSQL%20%7C%20PostGIS-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)

[Features](#-key-features) · [Architecture](#-system-architecture) · [AI Pipeline](#-ai--intelligence-layer) · [Getting Started](#-getting-started) · [Limitations](#-honest-limitations)

</div>

---

## 🌍 The Problem

Damaged roads, overflowing waste bins, broken streetlights, water leaks, and other local infrastructure issues can affect entire communities.

However, reporting these problems, identifying their locations, prioritizing their urgency, and tracking their resolution can be fragmented across different channels.

Residents may struggle to understand what happens after submitting a report, while teams responsible for addressing issues need clear information to coordinate their work.

**CivicLens AI explores how mapping, structured reporting, AI-assisted classification, and transparent case tracking can make civic issue management more organized.**

## 💡 What Is CivicLens AI?

CivicLens AI is an independent civic-tech platform that connects residents, issue reports, and staff workflows through a centralized web application.

Residents can photograph a problem, select its location on a map, describe the issue, and track its status. Authorized staff can moderate reports, assess severity, assign cases, merge confirmed duplicates, and document resolutions.

The platform also provides geographic visualizations and database-driven analytics to help users understand reported issues and resolution activity.

### 🎯 Core Objectives

- Simplify civic issue reporting.
- Improve the visibility of reported problems.
- Use AI to assist with image classification and duplicate detection.
- Support human-led triage and case management.
- Make resolution progress easier to follow.
- Generate useful insights from structured geographic data.

## ✨ Key Features

### 📸 1. Smart Issue Reporting

Residents can submit structured reports through a guided workflow.

- Upload up to four photographs per report.
- Select a location using an interactive map or browser geolocation.
- Choose an issue category and provide a description.
- Review report details and consent before submission.
- Track the report after submission.

The guided process helps associate each report with a location, category, and visual record.

### 🗺️ 2. Interactive Geographic Explorer

Explore reported civic issues across different geographic scales.

- Tamil Nadu, India, and global map views.
- A "Near me" location option.
- Category filters for targeted exploration.
- Server-side spatial clustering using PostGIS.
- Cluster recalculation as the map zoom level changes.
- OpenStreetMap as the default mapping option.
- Optional Google Maps integration when a browser API key is configured.

Spatial clustering helps keep the map readable when many reports are concentrated in the same area.

### 🤖 3. AI-Assisted Image Intelligence

CivicLens AI includes an image-analysis pipeline designed to support report processing.

**Image classification**

A PyTorch MobileNetV3 classifier can predict issue categories from submitted images when a compatible trained checkpoint is available.

**Visual severity suggestion**

Image statistics provide a preliminary severity suggestion. This is a heuristic rather than a trained severity model, and human review remains necessary.

**Duplicate report detection**

Perceptual image hashing helps identify visually similar photographs, while spatial queries identify nearby reports that may describe the same problem.

These capabilities are intended to assist staff, not independently determine the final outcome of a report.

### 🔎 4. Duplicate Detection & Case Merging

The platform searches for potentially duplicate reports using a combination of geographic proximity and image similarity.

The documented matching criteria include:

- A search radius of 60 metres.
- Matching issue categories.
- Active reports from the previous 120 days.
- Photo similarity checks.

Staff review potential matches and decide whether reports should be merged.

**Nothing is merged automatically.** This preserves human oversight and reduces the risk of combining unrelated problems.

### 📊 5. Public Impact Dashboard

The dashboard presents database-backed summaries of reported issues and resolution activity.

- Resolution-status visualization.
- Overall status distribution.
- Per-category report counts.
- Aggregated issue statistics.

The values are calculated from application data rather than hard-coded display counters.

### 👤 6. Resident Dashboard

Registered residents can access their own reporting history.

- View submitted reports.
- Follow status changes through a timeline.
- Read public case notes.
- Review resolution photographs when available.

This provides a clearer view of how a submitted issue progresses through the workflow.

### 🛠️ 7. Staff Operations

Authorized staff members can manage reports through a dedicated operational interface.

- Approve or reject submissions with a reason.
- Review the moderation queue.
- Set human-assessed severity.
- Update case status.
- Assign reports to staff members.
- Attach photographic resolution evidence.
- Merge confirmed duplicate reports.

The workflow keeps report publication and case resolution under human control.

### 🔐 8. Administration & Analytics

Administrative capabilities support oversight and operational analysis.

- Role management.
- Median time to resolution.
- Open cases grouped by severity.
- Category-level reporting statistics.
- Geographic issue hotspots.
- Agreement between AI predictions and human decisions.

These metrics help evaluate the workflow and understand patterns in the available data.

## 🧠 AI & Intelligence Layer

CivicLens AI combines image classification, image similarity, and spatial reasoning.

| Component | Technique | Purpose |
|---|---|---|
| Image classification | PyTorch MobileNetV3 | Predict an issue category when a trained checkpoint is available |
| Severity suggestion | Image-statistics heuristic | Provide a preliminary visual severity indicator |
| Duplicate detection | Perceptual hashing | Identify visually similar report photographs |
| Geographic matching | PostGIS radius queries | Find nearby reports within defined criteria |
| AI evaluation | Prediction–human agreement metrics | Monitor how model predictions compare with human decisions |

### AI Processing Flow

<box border radius="lg" padding={3} gap={2} align="center">
  <box background="surface-secondary" radius="md" padding={3} width="100%" align="center">
    **1. Report Submission**

    <text color="secondary" size="sm" textAlign="center">Images, category, description, and geographic location</text>
  </box>
  <icon name="arrow-down" size="xl" color="secondary"/>
  <box border radius="md" padding={3} width="100%" align="center">
    **2. Image Processing**

    <text color="secondary" size="sm" textAlign="center">Photo handling, metadata removal, and configured image analysis</text>
  </box>
  <icon name="arrow-down" size="xl" color="secondary"/>
  <box border radius="md" padding={3} width="100%" align="center">
    **3. Classification & Matching**

    <text color="secondary" size="sm" textAlign="center">Optional model prediction, heuristic severity, and potential duplicate matching</text>
  </box>
  <icon name="arrow-down" size="xl" color="secondary"/>
  <box background="surface-secondary" radius="md" padding={3} width="100%" align="center">
    **4. Human Review**

    <text color="secondary" size="sm" textAlign="center">Staff moderation, severity assessment, triage, and case management</text>
  </box>
  <icon name="arrow-down" size="xl" color="secondary"/>
  <box border radius="md" padding={3} width="100%" align="center">
    **5. Tracking & Analytics**

    <text color="secondary" size="sm" textAlign="center">Status updates, resolution evidence, and database-driven metrics</text>
  </box>
</box>

## 🏗️ System Architecture

CivicLens AI brings together a web interface, an application backend, AI processing, and a geospatial database.

| Layer | Responsibility |
|---|---|
| Frontend | Reporting, maps, dashboards, resident views, and staff interfaces |
| API backend | Validation, authentication, reporting workflows, and authorization |
| AI services | Image classification, heuristic severity suggestions, and similarity processing |
| Geospatial database | Report storage, geographic queries, clustering, and spatial indexing |
| File storage | Report photographs and resolution evidence |
| Analytics | Aggregated report, category, severity, and resolution metrics |

### Geospatial Engineering

PostgreSQL and PostGIS provide the geographic foundation.

- Radius searches help identify nearby reports.
- GiST spatial indexes support geographic query performance.
- Server-side clustering reduces map clutter.
- Database constraints help enforce data integrity.

The spatial matching criteria can help staff identify potentially related cases without assuming that nearby reports necessarily describe the same issue.

## 🔐 Privacy, Security & Responsible AI

CivicLens AI incorporates several safeguards into its documented implementation.

- **Human moderation:** Reports are reviewed before becoming public.
- **Reporter privacy:** Reporter identities are hidden from public-facing views.
- **Photo privacy:** EXIF and GPS metadata are stripped from uploaded photographs.
- **Session security:** HTTP-only cookie-based sessions are used.
- **Request protection:** CSRF headers and rate limits help protect sensitive workflows.
- **Data integrity:** Database CHECK constraints and spatial indexes support reliable data handling.
- **Controlled administration:** Role management supports restricted administrative operations.
- **Transparent AI:** Predictions and severity suggestions are not substitutes for human judgment.

These controls contribute to safer handling of civic reports, although a complete security assessment is still necessary before any real-world deployment.

## ⚙️ Technology Stack

| Technology | Purpose |
|---|---|
| React / TypeScript | Interactive frontend |
| FastAPI | Backend API, if configured as in the application architecture |
| PyTorch | Image-classification model |
| MobileNetV3 | Lightweight image-classification architecture |
| PostgreSQL | Relational data storage |
| PostGIS | Geospatial queries and spatial indexing |
| Alembic | Database migrations |
| OpenStreetMap | Default mapping source |
| Google Maps | Optional map provider |
| Automated tests | Backend and frontend verification |

The frontend uses self-hosted Fraunces and Inter fonts through `@fontsource-variable`, avoiding external font requests.

The interface also includes original scroll reveals, animated headings, count-up statistics, pointer spotlight effects, and a category marquee. Motion effects are disabled for visitors who prefer reduced motion.

## 🧪 Testing & Data Integrity

The project includes a documented test suite comprising:

- 35 backend tests.
- 7 frontend tests.
- Alembic database migrations.
- Database CHECK constraints.
- GiST spatial indexes.
- A database seed script.

These tests and database controls support regression prevention and data integrity. Passing tests do not, by themselves, establish the accuracy of the AI model or the suitability of the platform for production deployment.

## 🚀 Getting Started

The following is a high-level setup guide. Use the actual dependency files and environment configuration included in the repository for exact commands.

### Prerequisites

- Node.js and a compatible package manager.
- Python compatible with the backend dependencies.
- PostgreSQL with PostGIS enabled.
- A database accessible to the backend.
- Optional trained model checkpoint for image classification.
- Optional mapping API key if using Google Maps.

### Installation

**1. Clone the repository**

```bash
git clone <YOUR_REPOSITORY_URL>
cd <YOUR_PROJECT_DIRECTORY>
```

**2. Configure the backend**

Create and activate a Python virtual environment, install the dependencies specified by the project, and configure the required environment variables.

```bash
python -m venv .venv
```

**3. Configure the database**

Create the PostgreSQL database, enable PostGIS, and apply the project's Alembic migrations using the configured database connection.

**4. Configure the frontend**

Install the JavaScript dependencies and configure the API endpoint according to the project's environment settings.

**5. Start the application**

Run the backend and frontend using the repository's documented development commands.

*The exact migration, startup, and environment-variable commands should be taken from the project configuration rather than guessed.*

## ⚠️ Honest Limitations

CivicLens AI is an independent software project, not an official civic reporting service.

### AI Model Availability

**No trained model checkpoint ships with the project.**

Without a compatible trained checkpoint, the application runs in demo mode:

- The selected category remains the resident's chosen category.
- No genuine model confidence score is available.
- The interface identifies the experience as demo mode.

The training script is located at `backend/app/ai/train.py`, but training requires appropriately labelled photographs. Tests using a small synthetic model validate the execution path, not real-world classification accuracy.

### Severity Assessment

Severity is estimated using image statistics, not a trained severity-prediction model. It is a preliminary suggestion and must be confirmed by a person during triage.

### Duplicate Detection

Geographic proximity and perceptual similarity can identify candidates, but they cannot guarantee that two reports refer to the same underlying problem. Staff must review potential duplicates before merging.

### Operational Scope

The project does not integrate with any city administration, government platform, or official 311 service. It does not guarantee that a reported problem will be addressed by a public authority.

## 🔭 Future Possibilities

- [ ] Train and evaluate the image-classification model on a representative labelled dataset.
- [ ] Measure per-category precision, recall, and confusion matrices.
- [ ] Improve confidence calibration and uncertainty handling.
- [ ] Add accessibility improvements to map-based reporting.
- [ ] Introduce notification preferences for case updates.
- [ ] Expand operational analytics and reporting exports.
- [ ] Conduct security and privacy reviews before production use.
- [ ] Evaluate usability with residents and staff in controlled pilot studies.

## ⚖️ Important Disclaimer

**CivicLens AI is not a government system.**

It is independent software with no integration with any city, 311 service, or government platform. Reports submitted through the application are not official complaints and do not guarantee public-sector action.

All sample data is fictional. Real-world deployment would require appropriate authorization, operational partnerships, privacy review, and independent validation of AI capabilities.

## 👨‍💻 Built by Vicky

Created by [@Vicky-45-11](https://github.com/Vicky-45-11).

An exploration of AI-assisted classification, geospatial computing, responsible software engineering, and technology for community-oriented problem solving.

---

<div align="center">

### 🏙️ CivicLens AI

**Make problems visible. Make progress measurable.**

*Better civic insights begin with better information.*

</div>
