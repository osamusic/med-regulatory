#!/bin/bash

# Create ssl directory if it doesn't exist
mkdir -p nginx/ssl

# Create config file for certificate with SAN
cat > nginx/ssl/cert.conf <<EOF
[req]
default_bits = 2048
prompt = no
default_md = sha256
distinguished_name = dn
req_extensions = v3_req

[dn]
C=JP
ST=Tokyo
L=Tokyo
O=MedShield
OU=IT
CN=localhost

[v3_req]
basicConstraints = CA:FALSE
keyUsage = nonRepudiation, digitalSignature, keyEncipherment
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
DNS.2 = *.localhost
IP.1 = 127.0.0.1
IP.2 = 192.168.11.34
IP.3 = ::1
EOF

# Generate self-signed SSL certificate with SAN
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout nginx/ssl/nginx-selfsigned.key \
    -out nginx/ssl/nginx-selfsigned.crt \
    -config nginx/ssl/cert.conf \
    -extensions v3_req

# Set proper permissions
chmod 600 nginx/ssl/nginx-selfsigned.key
chmod 644 nginx/ssl/nginx-selfsigned.crt

# Clean up config file
rm nginx/ssl/cert.conf

echo "SSL certificates generated successfully!"
echo "Certificate: nginx/ssl/nginx-selfsigned.crt"
echo "Private key: nginx/ssl/nginx-selfsigned.key"
echo "Certificate includes SANs for localhost and 192.168.11.34"