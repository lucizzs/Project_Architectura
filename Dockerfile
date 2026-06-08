FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --prefer-offline

COPY . .

ENV NODE_ENV=test
ENV JWT_SECRET=docker_test_secret_at_least_16_chars

CMD ["npm", "run", "test:ci"]
