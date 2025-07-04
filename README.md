# Rethink Media

A full-stack AI-powered content generation platform built with the T3 Stack (Next.js, tRPC, Drizzle ORM, Tailwind CSS, and more). This project enables users to generate, edit, and manage media content (text, images, audio, video) using advanced AI models.

---

## Features
- AI-powered content generation (text, image, audio, video)
- Modern UI with Tailwind CSS and Radix UI
- Type-safe API with tRPC
- PostgreSQL database via Drizzle ORM
- Audio and image generation using Google GenAI and Gemini APIs

---

## Getting Started

### 1. Prerequisites
- **Node.js** v18 or later
- **pnpm** (recommended) or npm/yarn
- **Docker** or **Podman** (for local database)

### 2. Clone the Repository
```bash
git clone <your-repo-url>
cd rethink-media
```

### 3. Install Dependencies
```bash
pnpm install
# or
npm install
```

### 4. Configure Environment Variables
Create a `.env` file in the project root. Required variables:

```
# Database
DATABASE_URL=postgres://postgres:password@localhost:5432/rethink_media
NODE_ENV=development

# Google GenAI / Gemini (for AI features)
GOOGLE_CLOUD_PROJECT=your-google-cloud-project-id
GOOGLE_CLOUD_LOCATION=us-central1
GOOGLE_GENAI_USE_VERTEXAI=false
GEMINI_API_KEY=your-gemini-api-key

# (Optional for deployment)
VERCEL_URL=your-vercel-url
PORT=3000
```

- `DATABASE_URL`: PostgreSQL connection string. The default works with the provided Docker setup.
- `GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_LOCATION`, `GOOGLE_GENAI_USE_VERTEXAI`: For Google GenAI image/audio APIs.
- `GEMINI_API_KEY`: For Gemini text/audio APIs.
- `VERCEL_URL`, `PORT`: Used for deployment and server config.

---

## Setting Up a Local PostgreSQL Database

This project provides a script to easily set up a local PostgreSQL database using Docker or Podman.

### Using the `start-database.sh` Script

1. **Ensure you have Docker or Podman installed and running.**
   - [Docker installation guide](https://docs.docker.com/engine/install/)
   - [Podman installation guide](https://podman.io/getting-started/installation)

2. **Configure your `.env` file** with a valid `DATABASE_URL` (see above).

3. **Run the script:**
   ```bash
   ./start-database.sh
   ```
   - The script will:
     - Parse your `DATABASE_URL` to determine the database name, port, and password.
     - Start a new PostgreSQL container (or start an existing one if already created).
     - Warn you if the default password is used and offer to generate a secure one.
     - Check if the required port is available.
   - The database will be accessible at the host and port specified in your `DATABASE_URL`.

4. **Windows users:**
   - Use [WSL](https://learn.microsoft.com/en-us/windows/wsl/install) and Docker Desktop or Podman Desktop.
   - Run the script from your WSL terminal.

---

## Continue Project Setup

### 5. Run Database Migrations
```bash
pnpm db:push
# or
npm run db:push
```

### 6. Start the Development Server
```bash
pnpm dev
# or
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to use the app.

---

## Scripts
- `pnpm dev` — Start Next.js in development mode
- `pnpm build` — Build for production
- `pnpm start` — Start production server
- `pnpm db:push` — Push Drizzle ORM migrations
- `pnpm db:migrate` — Run migrations
- `pnpm db:drop` — Drop the database
- `pnpm db:studio` — Open Drizzle Studio

---

## Tech Stack
- **Next.js** — React framework
- **tRPC** — End-to-end typesafe APIs
- **Drizzle ORM** — Type-safe SQL for PostgreSQL
- **Tailwind CSS** — Utility-first CSS
- **Radix UI** — Accessible UI primitives
- **Google GenAI / Gemini** — AI content generation
- **Jotai** — State management
- **Jest** — Testing

---

## Deployment
- Supports [Vercel](https://vercel.com/), [Netlify](https://www.netlify.com/), and Docker.
- Set all required environment variables in your deployment platform.

---

## Troubleshooting
- Ensure all environment variables are set and valid.
- Database connection issues? Check `DATABASE_URL` and that your Docker/Postgres is running.
- For Google AI features, ensure your API keys and project IDs are correct and have the right permissions.

---

## License
MIT
