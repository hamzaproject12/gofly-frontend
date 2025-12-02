import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

interface AuthRequest extends Request {
  user?: any;
}

export const authenticateToken = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  // Debug logging
  console.log('🔒 Auth Middleware - Headers:', req.headers);
  console.log('🍪 Auth Middleware - Cookies:', req.cookies);

  // Try to get token from Authorization header first
  const authHeader = req.headers['authorization'];
  let token = authHeader && authHeader.split(' ')[1];

  if (token) console.log('✅ Token found in Header');

  // If no token in header, try to get from cookies
  if (!token) {
    token = req.cookies?.authToken;
    if (token) console.log('✅ Token found in Cookie');
  }

  if (!token) {
    console.log('❌ No token found');
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const user = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret');
    req.user = user;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid token' });
  }
}; 