#!/bin/bash

: "${SERVER_BACKEND_URL:?SERVER_BACKEND_URL must be set}"
API_BASE_URL="${SERVER_BACKEND_URL%/}"
URL="${API_BASE_URL}/drakon_api"
DATA='{"method": "authenticate"}'

curl -X POST -H "Content-Type: application/json" -d "$DATA" "$URL"
