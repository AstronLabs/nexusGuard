import { Router, Request, Response, NextFunction } from 'express';
import { notificationService } from '../services/notification.service';
import { authMiddleware } from '../middleware/auth.middleware';
import { createHttpError } from '../middleware/error.middleware';
import { ApiResponse, Notification } from '../types';

const router = Router();

/**
 * GET /api/notifications
 * Get notifications for the authenticated user.
 * Query params: ?limit=50&unreadOnly=false
 */
router.get('/', authMiddleware, (req: Request, res: Response, next: NextFunction) => {
  try {
    const address = req.stellarAddress!;
    const limit = parseInt(req.query.limit as string, 10) || 50;
    const unreadOnly = req.query.unreadOnly === 'true';

    const notifications = notificationService.getByRecipient(address, limit, unreadOnly);
    const unreadCount = notificationService.getUnreadCount(address);

    const response: ApiResponse<{ notifications: Notification[]; unreadCount: number }> = {
      success: true,
      data: { notifications, unreadCount },
      timestamp: new Date().toISOString(),
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/notifications/unread-count
 * Get unread notification count.
 */
router.get('/unread-count', authMiddleware, (req: Request, res: Response, next: NextFunction) => {
  try {
    const address = req.stellarAddress!;
    const count = notificationService.getUnreadCount(address);

    res.json({
      success: true,
      data: { unreadCount: count },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/notifications/:id/read
 * Mark a single notification as read.
 */
router.patch('/:id/read', authMiddleware, (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const updated = notificationService.markAsRead(id);

    if (!updated) {
      throw createHttpError(404, 'Notification not found');
    }

    res.json({
      success: true,
      data: { id, read: true },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/notifications/read-all
 * Mark all notifications as read for the authenticated user.
 */
router.patch('/read-all', authMiddleware, (req: Request, res: Response, next: NextFunction) => {
  try {
    const address = req.stellarAddress!;
    const count = notificationService.markAllAsRead(address);

    res.json({
      success: true,
      data: { markedAsRead: count },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/notifications/:id
 * Delete a notification.
 */
router.delete('/:id', authMiddleware, (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const deleted = notificationService.delete(id);

    if (!deleted) {
      throw createHttpError(404, 'Notification not found');
    }

    res.json({
      success: true,
      data: { id, deleted: true },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
