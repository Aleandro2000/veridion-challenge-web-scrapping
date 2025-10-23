#!/bin/bash
set -e

echo "Building and starting containers for STAGING..."
docker-compose --profile staging build
docker-compose --profile staging up -d

echo "Staging deployment completed!"
