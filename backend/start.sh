#!/usr/bin/env bash

echo "Starting ML service..."
cd ../ml_models
python serve.py &

echo "Starting Node server..."
cd ../backend
npm start