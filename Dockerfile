# Use the latest LTS Node.js version
FROM node:22-alpine AS base

# Set working directory
WORKDIR /usr/src/app

# Copy only package files
COPY package.json package-lock.json ./

# Install production dependencies
RUN npm ci

# Copy the rest of the application code
COPY src/ ./src/
COPY public/ ./public/

# Expose the app port
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
