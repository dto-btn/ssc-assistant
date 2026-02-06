# mTLS certificates (local/dev)

This folder is a placeholder for local/dev certificates.

Recommended files:
- `ca.pem` (CA certificate)
- `api.pem` (API/server certificate)
- `api-key.pem` (API/server private key)

Example using openssl (self-signed CA + server cert):
1. Generate CA:
   - `openssl genrsa -out ca.key 4096`
   - `openssl req -x509 -new -nodes -key ca.key -sha256 -days 3650 -out ca.pem`
2. Generate server cert:
   - `openssl genrsa -out api-key.pem 4096`
   - `openssl req -new -key api-key.pem -out api.csr`
   - `openssl x509 -req -in api.csr -CA ca.pem -CAkey ca.key -CAcreateserial -out api.pem -days 825 -sha256`

Do not commit private keys.
