#!/bin/bash

# Generate nginx configuration from template using environment variables

# Load environment variables
if [ -f .env ]; then
    source .env
fi

# Use defaults if not set
DOMAIN_NAME=${DOMAIN_NAME:-osamusic.org}
DOMAIN_ALIASES=${DOMAIN_ALIASES:-www.osamusic.org}

echo "Generating nginx configuration for domains: $DOMAIN_NAME, $DOMAIN_ALIASES"

# Use envsubst to replace variables in template
envsubst '$DOMAIN_NAME $DOMAIN_ALIASES' < nginx/nginx.conf.template > nginx/nginx.conf

echo "nginx.conf generated successfully"

# Also generate nginx-http-only.conf from the same template but remove SSL sections
echo "Generating nginx-http-only.conf..."

# Create a temporary file
TEMP_FILE=$(mktemp)

# Copy template and remove SSL server block
envsubst '$DOMAIN_NAME $DOMAIN_ALIASES' < nginx/nginx.conf.template | \
sed '/# HTTPS server/,/^    }$/d' > "$TEMP_FILE"

# Remove the redirect from HTTP server
sed -i '/ # Redirect all other traffic to HTTPS/,/^        }$/d' "$TEMP_FILE"

# Add closing brace for HTTP server if needed
echo "    }" >> "$TEMP_FILE"
echo "}" >> "$TEMP_FILE"

mv "$TEMP_FILE" nginx/nginx-http-only.conf

echo "nginx-http-only.conf generated successfully"