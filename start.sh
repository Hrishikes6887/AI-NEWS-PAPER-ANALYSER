#!/bin/bash

# Quick Start Script for UPSC Current Affairs Analyzer
# This script checks setup and runs the project

echo "🚀 UPSC Current Affairs Analyzer - Quick Start"
echo "=============================================="
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo ""
fi

# Check if .env has API key
if grep -q "your_gemini_api_key_here" .env 2>/dev/null; then
    echo "⚠️  WARNING: Please add your Gemini API key to .env file"
    echo "   Get it from: https://ai.google.dev/"
    echo ""
    echo "   Edit .env and replace:"
    echo "   VITE_GEMINI_API_KEY=your_gemini_api_key_here"
    echo ""
    read -p "Press Enter to continue anyway (will use mock data)..."
    echo ""
fi

# Create uploads directory if it doesn't exist
mkdir -p uploads

echo "✅ Setup complete!"
echo ""
echo "🎯 Starting both servers..."
echo "   - Backend:  http://localhost:3001"
echo "   - Frontend: http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop both servers"
echo ""

# Start both servers
npm run dev:full
