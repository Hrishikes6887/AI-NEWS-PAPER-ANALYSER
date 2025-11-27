import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        configure: (proxy, options) => {
          // Fallback to mock handler if backend is not running
          proxy.on('error', (err, req, res) => {
            console.warn('API proxy error, using mock response');
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              success: true,
              data: {
                source_file: 'mock-document.pdf',
                categories: {
                  polity: [{
                    title: 'Mock Analysis - Local Backend Required',
                    points: [
                      'The local backend server is not running',
                      'Start the backend with: node server.js',
                      'Or implement the /api/analyze endpoint'
                    ],
                    references: [{ page: 1, excerpt: 'Mock reference' }],
                    confidence: 0.75
                  }],
                  economy: [],
                  international_relations: [],
                  science_tech: [],
                  environment: [],
                  geography: [],
                  culture: [],
                  security: [],
                  misc: []
                }
              }
            }));
          });
        }
      }
    }
  }
});
