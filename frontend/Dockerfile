FROM node:18-alpine

# Install curl for health check
RUN apk add --no-cache curl

# Create a non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

WORKDIR /app

# Define build arguments
ARG VITE_API_URL
ARG NODE_ENV
ARG VITE_GOOGLE_CLIENT_ID
ARG VITE_ALLOWED_HOSTS

# Set environment variables
ENV NODE_ENV=${NODE_ENV}
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_GOOGLE_CLIENT_ID=${VITE_GOOGLE_CLIENT_ID}
ENV VITE_ALLOWED_HOSTS=${VITE_ALLOWED_HOSTS}

COPY package*.json ./

RUN npm install

# Create environment files
RUN echo "VITE_API_URL=${VITE_API_URL}" > .env.development && \
    echo "VITE_GOOGLE_CLIENT_ID=${VITE_GOOGLE_CLIENT_ID}" >> .env.development && \
    echo "VITE_ALLOWED_HOSTS=${VITE_ALLOWED_HOSTS}" >> .env.development

COPY . .

# Ensure postcss.config.js uses CommonJS format
RUN if grep -q "export default" /app/postcss.config.js; then \
    sed -i 's/export default/module.exports =/' /app/postcss.config.js; \
fi

# Change ownership of the app directory to the non-root user
RUN chown -R nextjs:nodejs /app

# Switch to non-root user
USER nextjs

EXPOSE 5173

# Add health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:5173/ || exit 1

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
