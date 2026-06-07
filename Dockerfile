FROM node:20-alpine AS base
WORKDIR /app

# Dependencies
COPY package*.json ./
RUN npm ci --ignore-scripts

# Source
COPY tsconfig.json jest.config.js sonar-project.properties ./
COPY src/ ./src/
COPY tests/ ./tests/

# Run tests by default
CMD ["npm", "run", "test:ci"]
