import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { ipfsService } from '../services/ipfs.service';
import { authMiddleware } from '../middleware/auth.middleware';
import { x402PaymentGate } from '../middleware/x402.middleware';
import { createHttpError } from '../middleware/error.middleware';
import { ApiResponse, IpfsUploadResult } from '../types';

const router = Router();

// Configure multer for file uploads (10MB max)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'image/jpeg', 'image/png', 'image/webp', 'image/gif',
      'application/pdf',
      'video/mp4', 'video/webm',
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not allowed`));
    }
  },
});

/**
 * POST /api/ipfs/upload
 * Upload a file to IPFS via Pinata — x402 payment gated.
 */
router.post(
  '/upload',
  authMiddleware,
  x402PaymentGate({
    amount: '0.005',
    asset: 'USDC',
    description: 'IPFS upload cost recovery',
  }),
  upload.single('file'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const file = req.file;
      if (!file) {
        throw createHttpError(400, 'No file provided. Use multipart/form-data with field "file".');
      }

      const metadata: Record<string, string> = {};
      if (req.body.claimId) metadata.claim_id = req.body.claimId;
      if (req.body.poolId) metadata.pool_id = req.body.poolId;
      if (req.stellarAddress) metadata.uploader = req.stellarAddress;

      const result = await ipfsService.uploadFile(
        file.buffer,
        file.originalname,
        file.mimetype,
        metadata
      );

      const response: ApiResponse<IpfsUploadResult> = {
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      };

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/ipfs/upload-json
 * Upload JSON data to IPFS.
 */
router.post(
  '/upload-json',
  authMiddleware,
  x402PaymentGate({
    amount: '0.005',
    asset: 'USDC',
    description: 'IPFS JSON upload cost recovery',
  }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { data, name } = req.body;
      if (!data || !name) {
        throw createHttpError(400, 'Missing required fields: data, name');
      }

      const metadata: Record<string, string> = {};
      if (req.stellarAddress) metadata.uploader = req.stellarAddress;

      const result = await ipfsService.uploadJSON(data, name, metadata);

      const response: ApiResponse<IpfsUploadResult> = {
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      };

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/ipfs/pin/:cid
 * Check if a CID is pinned on Pinata.
 */
router.get('/pin/:cid', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { cid } = req.params;

    if (!ipfsService.isValidCid(cid)) {
      throw createHttpError(400, 'Invalid CID format');
    }

    const isPinned = await ipfsService.isPinned(cid);

    res.json({
      success: true,
      data: {
        cid,
        isPinned,
        gatewayUrl: ipfsService.getGatewayUrl(cid),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
