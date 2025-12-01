# Gofly Backend

Backend API for the Gofly travel management system.

## Railway Deployment

### Environment Variables Required:

```bash
# Database (Railway will provide this automatically)
DATABASE_URL="postgresql://..."

# Server Port (Railway will set this automatically)
PORT=5000

# Frontend URL (set this to your Vercel domain after deployment)
FRONTEND_URL="https://your-app.vercel.app" 
```

### Deployment Steps:

1. **Connect to Railway**: Link your GitHub repository
2. **Add PostgreSQL**: Railway will automatically add a PostgreSQL database
3. **Set Environment Variables**: Add the required environment variables
4. **Deploy**: Railway will automatically build and deploy

### Build Process:

- `npm install` - Install dependencies
- `npm run build` - Compile TypeScript and generate Prisma client
- `npm start` - Start the server

### API Endpoints:

- `GET /api/programs` - Get all travel programs
- `GET /api/reservations` - Get all reservations
- `POST /api/reservations` - Create new reservation
- `GET /api/expenses` - Get all expenses
- `POST /api/expenses` - Create new expense
- `POST /api/upload` - Upload files
- `GET /api/hotels` - Get available hotels
- `POST /api/payments` - Process payments
