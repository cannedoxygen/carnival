import { Request, Response, NextFunction } from 'express';
import { ethers } from 'ethers';
import jwt from 'jsonwebtoken';
import pino from 'pino';
import NodeCache from 'node-cache';

const logger = pino({ name: 'auth-middleware' });

// Cache for verified addresses (TTL: 1 hour)
const addressCache = new NodeCache({ stdTTL: 3600 });

// Cache for nonces (TTL: 10 minutes)
const nonceCache = new NodeCache({ stdTTL: 600 });

interface AuthenticatedRequest extends Request {
  userAddress?: string;
  userToken?: string;
}

interface SignatureData {
  signature: string;
  message: string;
  address: string;
  timestamp: number;
}

interface JWTPayload {
  address: string;
  iat: number;
  exp: number;
}

const JWT_SECRET = process.env.JWT_SECRET || 'your-jwt-secret-key';
const MESSAGE_PREFIX = 'Sign this message to authenticate with Simpsons Carnival: ';
const MAX_MESSAGE_AGE = 5 * 60 * 1000; // 5 minutes

/**
 * Generate a random nonce for message signing
 */
export function generateNonce(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

/**
 * Get nonce for address - generates new one if doesn't exist
 */
export function getNonceForAddress(address: string): string {
  const normalizedAddress = address.toLowerCase();
  let nonce = nonceCache.get<string>(normalizedAddress);
  
  if (!nonce) {
    nonce = generateNonce();
    nonceCache.set(normalizedAddress, nonce);
  }
  
  return nonce;
}

/**
 * Verify wallet signature and return recovery address
 */
async function verifyWalletSignature(signatureData: SignatureData): Promise<string> {
  try {
    const { signature, message, address, timestamp } = signatureData;
    
    // Check message age
    if (Date.now() - timestamp > MAX_MESSAGE_AGE) {
      throw new Error('Message too old');
    }
    
    // Verify message format
    if (!message.startsWith(MESSAGE_PREFIX)) {
      throw new Error('Invalid message format');
    }
    
    // Extract and verify nonce from message
    const nonceFromMessage = message.replace(MESSAGE_PREFIX, '').split(' ')[0];
    const storedNonce = nonceCache.get<string>(address.toLowerCase());
    
    if (!storedNonce || nonceFromMessage !== storedNonce) {
      throw new Error('Invalid or expired nonce');
    }
    
    // Verify signature
    const recoveredAddress = ethers.verifyMessage(message, signature);
    
    if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
      throw new Error('Signature verification failed');
    }
    
    // Clear used nonce
    nonceCache.del(address.toLowerCase());
    
    return recoveredAddress.toLowerCase();
    
  } catch (error) {
    logger.error({ error: error.message, signatureData }, 'Signature verification failed');
    throw new Error('Invalid signature');
  }
}

/**
 * Generate JWT token for authenticated address
 */
function generateJWTToken(address: string): string {
  return jwt.sign(
    { address: address.toLowerCase() },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

/**
 * Verify JWT token and return address
 */
function verifyJWTToken(token: string): string {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    return decoded.address;
  } catch (error) {
    throw new Error('Invalid token');
  }
}

/**
 * Authentication endpoint - authenticate with wallet signature
 */
export async function authenticateWallet(req: Request, res: Response): Promise<void> {
  try {
    const signatureData: SignatureData = req.body;
    
    if (!signatureData.signature || !signatureData.message || !signatureData.address) {
      res.status(400).json({
        error: 'Missing required fields: signature, message, address',
        timestamp: new Date().toISOString()
      });
      return;
    }
    
    // Verify signature
    const verifiedAddress = await verifyWalletSignature(signatureData);
    
    // Generate JWT token
    const token = generateJWTToken(verifiedAddress);
    
    // Cache the verified address
    addressCache.set(verifiedAddress, true);
    
    logger.info({ address: verifiedAddress }, 'Wallet authenticated successfully');
    
    res.json({
      success: true,
      address: verifiedAddress,
      token,
      expiresIn: '24h',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error({ error: error.message, body: req.body }, 'Authentication failed');
    res.status(401).json({
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Get nonce endpoint - returns nonce for address
 */
export function getNonce(req: Request, res: Response): void {
  try {
    const { address } = req.params;
    
    if (!address || !ethers.isAddress(address)) {
      res.status(400).json({
        error: 'Invalid address format',
        timestamp: new Date().toISOString()
      });
      return;
    }
    
    const nonce = getNonceForAddress(address);
    const timestamp = Date.now();
    const message = `${MESSAGE_PREFIX}${nonce} ${timestamp}`;
    
    res.json({
      nonce,
      message,
      timestamp,
      address: address.toLowerCase()
    });
    
  } catch (error) {
    logger.error({ error: error.message, address: req.params.address }, 'Failed to generate nonce');
    res.status(500).json({
      error: 'Failed to generate nonce',
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Authentication middleware - verifies JWT token or signature
 */
export default function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  try {
    // Check Authorization header for JWT token
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        const address = verifyJWTToken(token);
        req.userAddress = address;
        req.userToken = token;
        
        logger.debug({ address }, 'JWT authentication successful');
        return next();
      } catch (jwtError) {
        logger.debug({ error: jwtError.message }, 'JWT verification failed, checking for signature auth');
      }
    }
    
    // Check for signature in request body (for real-time authentication)
    if (req.body && req.body.signature && req.body.message && req.body.address) {
      verifyWalletSignature(req.body)
        .then(verifiedAddress => {
          req.userAddress = verifiedAddress;
          logger.debug({ address: verifiedAddress }, 'Signature authentication successful');
          next();
        })
        .catch(sigError => {
          logger.warn({ error: sigError.message }, 'Signature authentication failed');
          res.status(401).json({
            error: 'Authentication required. Please provide valid JWT token or wallet signature.',
            timestamp: new Date().toISOString()
          });
        });
      return;
    }
    
    // No valid authentication found
    res.status(401).json({
      error: 'Authentication required. Please provide valid JWT token or wallet signature.',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error({ error: error.message }, 'Authentication middleware error');
    res.status(500).json({
      error: 'Authentication service error',
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Optional auth middleware - doesn't require authentication but adds user info if available
 */
export function optionalAuthMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const address = verifyJWTToken(token);
      req.userAddress = address;
      req.userToken = token;
    } catch (error) {
      // Ignore authentication errors in optional middleware
      logger.debug({ error: error.message }, 'Optional auth failed');
    }
  }
  next();
}

/**
 * Admin middleware - checks if user is contract owner
 */
export function adminMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const adminAddresses = (process.env.ADMIN_ADDRESSES || '').toLowerCase().split(',');
  
  if (!req.userAddress || !adminAddresses.includes(req.userAddress.toLowerCase())) {
    res.status(403).json({
      error: 'Admin access required',
      timestamp: new Date().toISOString()
    });
    return;
  }
  
  next();
}

// Rate limiting for auth endpoints
export const authRateLimit = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 requests per windowMs for auth endpoints
  message: {
    error: 'Too many authentication attempts, please try again later.',
    timestamp: new Date().toISOString()
  }
};

export { AuthenticatedRequest };