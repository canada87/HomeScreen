# Stage 1: Build the frontend React app
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install

COPY frontend/ ./
RUN npm run build

# Stage 2: Build the backend Express server and assemble the app
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV DATA_DIR=/app/data
ENV PORT=3000

# Install production dependencies for backend
COPY backend/package.json backend/package-lock.json* ./
RUN npm install --omit=dev

# Copy backend source code
COPY backend/server.js backend/db.js ./

# Copy built frontend assets to backend public directory
COPY --from=frontend-builder /app/frontend/dist ./public

# Create directory for persistent SQLite database
RUN mkdir -p /app/data

# Expose port
EXPOSE 3000

# Run the app
CMD ["node", "server.js"]
