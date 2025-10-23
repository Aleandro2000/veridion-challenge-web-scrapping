#!/bin/bash
set -e

echo "Building and starting containers for PRODUCTION..."
docker-compose --profile production build
docker-compose --profile production up -d

echo "Production deployment completed!"