import express from 'express';
import { resolveProfile, apiRequireAuth, requireModerator } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validateBody } from '../middleware/validate.js';
import { str } from '../utils/params.js';
import { logger } from '../logger.js';
import * as support from '../core/supportRepository.js';
import { patchSupportTicketSchema } from './validation.js';

const router = express.Router();

router.post(
  '/support/tickets',
  apiRequireAuth(),
  asyncHandler(async (req, res) => {
    const profile = await resolveProfile(req);
    if (!profile) {
      res.status(403).json({ success: false, message: 'Profile not found' });
      return;
    }
    const { subject, category, priority, product_id, message } = req.body as Record<string, unknown>;
    if (!subject || typeof subject !== 'string' || !message || typeof message !== 'string') {
      res.status(400).json({ success: false, message: 'subject and message are required' });
      return;
    }
    const ticket = await support.createTicket({
      userId: profile.id,
      subject: String(subject).slice(0, 200),
      category: typeof category === 'string' ? category : 'other',
      priority: typeof priority === 'string' ? priority : 'normal',
      productId: typeof product_id === 'string' ? product_id : null,
      initialMessage: String(message).slice(0, 5000),
    });
    logger.info(`[support] Ticket created by ${profile.id}: ${ticket?.id}`);
    res.json({ success: true, data: ticket ? support.ticketToSnakeCase(ticket) : null });
  }),
);

router.get(
  '/support/tickets',
  apiRequireAuth(),
  asyncHandler(async (req, res) => {
    const profile = await resolveProfile(req);
    if (!profile) {
      res.status(403).json({ success: false, message: 'Profile not found' });
      return;
    }
    const tickets = await support.listTicketsByUser(profile.id);
    res.json({ success: true, data: tickets.map(support.ticketToSnakeCase) });
  }),
);

router.get(
  '/support/tickets/:id',
  apiRequireAuth(),
  asyncHandler(async (req, res) => {
    const profile = await resolveProfile(req);
    if (!profile) {
      res.status(403).json({ success: false, message: 'Profile not found' });
      return;
    }
    const ticket = await support.findTicketById(str(req.params.id));
    if (!ticket) {
      res.status(404).json({ success: false, message: 'Ticket not found' });
      return;
    }
    const isOwner = ticket.userId === profile.id;
    const isStaff = profile.role === 'moderator' || profile.role === 'admin' || profile.role === 'super_admin';
    if (!isOwner && !isStaff) {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }
    res.json({ success: true, data: support.ticketToSnakeCase(ticket) });
  }),
);

router.post(
  '/support/tickets/:id/messages',
  apiRequireAuth(),
  asyncHandler(async (req, res) => {
    const profile = await resolveProfile(req);
    if (!profile) {
      res.status(403).json({ success: false, message: 'Profile not found' });
      return;
    }
    const ticket = await support.findTicketById(str(req.params.id));
    if (!ticket) {
      res.status(404).json({ success: false, message: 'Ticket not found' });
      return;
    }
    const isOwner = ticket.userId === profile.id;
    const isStaff = profile.role === 'moderator' || profile.role === 'admin' || profile.role === 'super_admin';
    if (!isOwner && !isStaff) {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }
    const { message } = req.body as Record<string, unknown>;
    if (!message || typeof message !== 'string') {
      res.status(400).json({ success: false, message: 'message is required' });
      return;
    }
    const updated = await support.addMessage(str(req.params.id), {
      authorId: profile.id,
      role: isStaff ? 'staff' : 'user',
      text: String(message).slice(0, 5000),
      createdAt: new Date().toISOString(),
    });
    res.json({ success: true, data: updated ? support.ticketToSnakeCase(updated) : null });
  }),
);

router.patch(
  '/support/tickets/:id',
  apiRequireAuth(),
  requireModerator,
  validateBody(patchSupportTicketSchema),
  asyncHandler(async (req, res) => {
    const ticket = await support.findTicketById(str(req.params.id));
    if (!ticket) {
      res.status(404).json({ success: false, message: 'Ticket not found' });
      return;
    }
    const body = req.body as { status?: string; priority?: string; assigned_to?: string | null };
    const updated = await support.updateTicket(str(req.params.id), {
      status: body.status,
      priority: body.priority,
      assignedTo: body.assigned_to ?? undefined,
    });
    res.json({ success: true, data: updated ? support.ticketToSnakeCase(updated) : null });
  }),
);

router.get(
  '/support/admin/tickets',
  apiRequireAuth(),
  requireModerator,
  asyncHandler(async (req, res) => {
    const statusFilter = typeof req.query.status === 'string' ? req.query.status : undefined;
    const tickets = await support.listAllTickets(statusFilter);
    res.json({ success: true, data: tickets.map(support.ticketToSnakeCase) });
  }),
);

router.get(
  '/support/admin/tickets/stats',
  apiRequireAuth(),
  requireModerator,
  asyncHandler(async (_req, res) => {
    const stats = await support.getTicketStats();
    res.json({ success: true, data: stats });
  }),
);

export default router;
