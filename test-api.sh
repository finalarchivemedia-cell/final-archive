#!/bin/bash

BASE_URL="https://final-archive-production.up.railway.app"

echo "=== Testing Root Endpoint ==="
curl -s "$BASE_URL/"
echo -e "\n"

echo "=== Testing Health Endpoint ==="
curl -s "$BASE_URL/api/health"
echo -e "\n"

echo "=== Testing Images List (should be empty) ==="
curl -s "$BASE_URL/api/images"
echo -e "\n"

echo "=== Testing Settings ==="
curl -s "$BASE_URL/api/settings"
echo -e "\n"

echo "=== Testing Random Image (should fail) ==="
curl -s "$BASE_URL/api/images/random"
echo -e "\n"

echo "=== Testing Contact Endpoint ==="
curl -s -X POST "$BASE_URL/api/contact" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","message":"Test message"}'
echo -e "\n"

echo "=== Done! ==="
echo ""
echo "For Admin endpoints, you need to:"
echo "1. Login first: curl -X POST $BASE_URL/api/admin/login -H 'Content-Type: application/json' -d '{\"password\":\"YOUR_PASSWORD\"}'"
echo "2. Copy the token from response"
echo "3. Use token: curl $BASE_URL/api/admin/settings -H 'Authorization: Bearer YOUR_TOKEN'"
