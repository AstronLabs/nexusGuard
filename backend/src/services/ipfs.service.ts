import { config } from '../config';
import { logger } from '../utils/logger';
import { IpfsUploadResult } from '../types';

/**
 * IPFS Service — Pinata Integration
 * 
 * Handles file uploads, pinning, and CID validation via the Pinata API.
 * Used for claim evidence (images, documents, videos).
 */

const CTX = 'IPFSService';
const PINATA_API_BASE = 'https://api.pinata.cloud';

export class IpfsService {
  private apiKey: string;
  private secretKey: string;
  private gatewayUrl: string;

  constructor() {
    this.apiKey = config.pinata.apiKey;
    this.secretKey = config.pinata.secretKey;
    this.gatewayUrl = config.pinata.gatewayUrl;
  }

  /**
   * Upload a file buffer to IPFS via Pinata.
   */
  async uploadFile(
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string,
    metadata?: Record<string, string>
  ): Promise<IpfsUploadResult> {
    const formData = new FormData();
    const blob = new Blob([fileBuffer], { type: mimeType });
    formData.append('file', blob, fileName);

    // Add pinata metadata
    const pinataMetadata = {
      name: fileName,
      keyvalues: {
        source: 'nexusguard',
        ...(metadata || {}),
      },
    };
    formData.append('pinataMetadata', JSON.stringify(pinataMetadata));

    // Pin options
    formData.append('pinataOptions', JSON.stringify({ cidVersion: 1 }));

    try {
      const response = await fetch(`${PINATA_API_BASE}/pinning/pinFileToIPFS`, {
        method: 'POST',
        headers: {
          pinata_api_key: this.apiKey,
          pinata_secret_api_key: this.secretKey,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Pinata upload failed: ${response.status} - ${errorBody}`);
      }

      const result = await response.json() as { IpfsHash: string; PinSize: number };

      const uploadResult: IpfsUploadResult = {
        cid: result.IpfsHash,
        fileName,
        fileSize: result.PinSize,
        mimeType,
        pinataUrl: `${PINATA_API_BASE}/ipfs/${result.IpfsHash}`,
        gatewayUrl: `${this.gatewayUrl}/${result.IpfsHash}`,
        timestamp: new Date().toISOString(),
      };

      logger.info(CTX, `File uploaded to IPFS: ${result.IpfsHash}`, {
        fileName,
        size: result.PinSize,
      });

      return uploadResult;
    } catch (error) {
      logger.error(CTX, 'IPFS upload failed', { fileName, error });
      throw error;
    }
  }

  /**
   * Upload JSON data to IPFS via Pinata.
   */
  async uploadJSON(
    data: Record<string, unknown>,
    name: string,
    metadata?: Record<string, string>
  ): Promise<IpfsUploadResult> {
    try {
      const response = await fetch(`${PINATA_API_BASE}/pinning/pinJSONToIPFS`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          pinata_api_key: this.apiKey,
          pinata_secret_api_key: this.secretKey,
        },
        body: JSON.stringify({
          pinataContent: data,
          pinataMetadata: {
            name,
            keyvalues: {
              source: 'nexusguard',
              ...(metadata || {}),
            },
          },
          pinataOptions: { cidVersion: 1 },
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Pinata JSON upload failed: ${response.status} - ${errorBody}`);
      }

      const result = await response.json() as { IpfsHash: string; PinSize: number };
      const jsonStr = JSON.stringify(data);

      const uploadResult: IpfsUploadResult = {
        cid: result.IpfsHash,
        fileName: name,
        fileSize: result.PinSize,
        mimeType: 'application/json',
        pinataUrl: `${PINATA_API_BASE}/ipfs/${result.IpfsHash}`,
        gatewayUrl: `${this.gatewayUrl}/${result.IpfsHash}`,
        timestamp: new Date().toISOString(),
      };

      logger.info(CTX, `JSON uploaded to IPFS: ${result.IpfsHash}`, { name });
      return uploadResult;
    } catch (error) {
      logger.error(CTX, 'IPFS JSON upload failed', { name, error });
      throw error;
    }
  }

  /**
   * Check if a CID exists and is pinned on Pinata.
   */
  async isPinned(cid: string): Promise<boolean> {
    try {
      const response = await fetch(
        `${PINATA_API_BASE}/data/pinList?hashContains=${cid}&status=pinned`,
        {
          headers: {
            pinata_api_key: this.apiKey,
            pinata_secret_api_key: this.secretKey,
          },
        }
      );

      if (!response.ok) return false;
      const result = await response.json() as { count: number };
      return result.count > 0;
    } catch {
      return false;
    }
  }

  /**
   * Get the gateway URL for a CID.
   */
  getGatewayUrl(cid: string): string {
    return `${this.gatewayUrl}/${cid}`;
  }

  /**
   * Validate a CID format (basic check).
   */
  isValidCid(cid: string): boolean {
    // CIDv0 starts with Qm and is 46 chars, CIDv1 starts with b and varies
    return /^(Qm[a-zA-Z0-9]{44}|b[a-z2-7]{58,})$/.test(cid);
  }
}

export const ipfsService = new IpfsService();
