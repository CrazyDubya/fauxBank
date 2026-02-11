import { D1Database } from '@cloudflare/workers-types';
import { generateUUID } from '../utils/ids';
import { createAuditService } from './audit';

/**
 * Notification Service
 *
 * Handles webhook delivery and notification management for agents.
 * Critical for real-time event notifications in agentic systems.
 */

export type NotificationType =
  | 'TRANSACTION_POSTED'
  | 'TRANSACTION_FAILED'
  | 'AUTHORIZATION_APPROVED'
  | 'AUTHORIZATION_DECLINED'
  | 'AUTHORIZATION_CAPTURED'
  | 'AUTHORIZATION_VOIDED'
  | 'ACCOUNT_FROZEN'
  | 'ACCOUNT_CLOSED'
  | 'BALANCE_LOW'
  | 'FRAUD_ALERT'
  | 'KYC_STATUS_CHANGED'
  | 'DISPUTE_OPENED'
  | 'DISPUTE_RESOLVED';

export interface WebhookPayload {
  event_type: NotificationType;
  event_id: string;
  timestamp: string;
  data: Record<string, unknown>;
  webhook_url: string;
}

export interface NotificationRecord {
  id: string;
  agent_id: string;
  event_type: NotificationType;
  payload: Record<string, unknown>;
  status: 'PENDING' | 'DELIVERED' | 'FAILED' | 'RETRYING';
  attempts: number;
  last_attempt_at?: string;
  delivered_at?: string;
  error_message?: string;
  created_at: string;
}

export interface NotificationService {
  // Send notification to an agent
  notify(
    agentId: string,
    eventType: NotificationType,
    data: Record<string, unknown>
  ): Promise<string>;

  // Queue notification for batch delivery
  queueNotification(
    agentId: string,
    eventType: NotificationType,
    data: Record<string, unknown>
  ): Promise<string>;

  // Deliver a specific notification
  deliverNotification(notificationId: string): Promise<boolean>;

  // Process pending notifications
  processPendingNotifications(): Promise<{
    processed: number;
    delivered: number;
    failed: number;
  }>;

  // Get notification history
  getNotificationHistory(
    agentId: string,
    limit?: number
  ): Promise<NotificationRecord[]>;

  // Webhook subscription management
  subscribeToEvents(
    agentId: string,
    eventTypes: NotificationType[],
    webhookUrl: string
  ): Promise<void>;

  getSubscriptions(agentId: string): Promise<{
    event_types: NotificationType[];
    webhook_url: string;
  } | null>;
}

export function createNotificationService(db: D1Database): NotificationService {
  const audit = createAuditService(db);

  return {
    async notify(
      agentId: string,
      eventType: NotificationType,
      data: Record<string, unknown>
    ): Promise<string> {
      const notificationId = await this.queueNotification(agentId, eventType, data);

      // Attempt immediate delivery
      await this.deliverNotification(notificationId);

      return notificationId;
    },

    async queueNotification(
      agentId: string,
      eventType: NotificationType,
      data: Record<string, unknown>
    ): Promise<string> {
      const notificationId = generateUUID();
      const now = new Date().toISOString();

      await db
        .prepare(
          `INSERT INTO notifications (id, agent_id, event_type, payload, status, attempts, created_at)
           VALUES (?, ?, ?, ?, 'PENDING', 0, ?)`
        )
        .bind(notificationId, agentId, eventType, JSON.stringify(data), now)
        .run()
        .catch(() => {
          // If notifications table doesn't exist, log but continue
          console.warn('Notifications table not available');
        });

      return notificationId;
    },

    async deliverNotification(notificationId: string): Promise<boolean> {
      // Get notification details
      const notification = await db
        .prepare(`SELECT * FROM notifications WHERE id = ?`)
        .bind(notificationId)
        .first()
        .catch(() => null);

      if (!notification) {
        return false;
      }

      // Get agent's webhook URL
      const agent = await db
        .prepare(`SELECT webhook_url FROM agents WHERE id = ?`)
        .bind(notification.agent_id)
        .first();

      if (!agent?.webhook_url) {
        // No webhook configured - mark as delivered (no-op)
        await db
          .prepare(
            `UPDATE notifications SET status = 'DELIVERED', delivered_at = ? WHERE id = ?`
          )
          .bind(new Date().toISOString(), notificationId)
          .run()
          .catch(() => {});

        return true;
      }

      const now = new Date().toISOString();
      const payload: WebhookPayload = {
        event_type: notification.event_type as NotificationType,
        event_id: notificationId,
        timestamp: now,
        data: JSON.parse(notification.payload as string),
        webhook_url: agent.webhook_url as string,
      };

      try {
        // Attempt webhook delivery
        const response = await fetch(agent.webhook_url as string, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-FauxBank-Event': notification.event_type as string,
            'X-FauxBank-Signature': await signPayload(payload),
          },
          body: JSON.stringify(payload),
        });

        if (response.ok) {
          // Mark as delivered
          await db
            .prepare(
              `UPDATE notifications SET
                status = 'DELIVERED',
                delivered_at = ?,
                attempts = attempts + 1,
                last_attempt_at = ?
               WHERE id = ?`
            )
            .bind(now, now, notificationId)
            .run()
            .catch(() => {});

          return true;
        } else {
          throw new Error(`Webhook returned ${response.status}`);
        }
      } catch (error) {
        // Mark as failed/retrying
        const attempts = ((notification.attempts as number) || 0) + 1;
        const status = attempts >= 5 ? 'FAILED' : 'RETRYING';
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';

        await db
          .prepare(
            `UPDATE notifications SET
              status = ?,
              attempts = ?,
              last_attempt_at = ?,
              error_message = ?
             WHERE id = ?`
          )
          .bind(status, attempts, now, errorMsg, notificationId)
          .run()
          .catch(() => {});

        // Log delivery failure
        await audit.log({
          log_type: 'SECURITY_EVENT',
          agent_id: notification.agent_id as string,
          action: 'WEBHOOK_DELIVERY_FAILED',
          request: { notification_id: notificationId, webhook_url: agent.webhook_url },
          response: { error: errorMsg, attempts },
          outcome: 'FAILURE',
        });

        return false;
      }
    },

    async processPendingNotifications(): Promise<{
      processed: number;
      delivered: number;
      failed: number;
    }> {
      // Get pending/retrying notifications
      const pending = await db
        .prepare(
          `SELECT id FROM notifications
           WHERE status IN ('PENDING', 'RETRYING')
           AND (last_attempt_at IS NULL OR last_attempt_at < datetime('now', '-5 minutes'))
           ORDER BY created_at ASC
           LIMIT 100`
        )
        .all()
        .catch(() => ({ results: [] }));

      let delivered = 0;
      let failed = 0;

      for (const row of pending.results || []) {
        const success = await this.deliverNotification(row.id as string);
        if (success) {
          delivered++;
        } else {
          failed++;
        }
      }

      return {
        processed: (pending.results || []).length,
        delivered,
        failed,
      };
    },

    async getNotificationHistory(
      agentId: string,
      limit: number = 50
    ): Promise<NotificationRecord[]> {
      const results = await db
        .prepare(
          `SELECT * FROM notifications
           WHERE agent_id = ?
           ORDER BY created_at DESC
           LIMIT ?`
        )
        .bind(agentId, limit)
        .all()
        .catch(() => ({ results: [] }));

      return (results.results || []).map(row => ({
        id: row.id as string,
        agent_id: row.agent_id as string,
        event_type: row.event_type as NotificationType,
        payload: JSON.parse(row.payload as string),
        status: row.status as NotificationRecord['status'],
        attempts: row.attempts as number,
        last_attempt_at: row.last_attempt_at as string | undefined,
        delivered_at: row.delivered_at as string | undefined,
        error_message: row.error_message as string | undefined,
        created_at: row.created_at as string,
      }));
    },

    async subscribeToEvents(
      agentId: string,
      eventTypes: NotificationType[],
      webhookUrl: string
    ): Promise<void> {
      // Update agent's webhook URL
      await db
        .prepare(`UPDATE agents SET webhook_url = ? WHERE id = ?`)
        .bind(webhookUrl, agentId)
        .run();

      // Store subscribed event types (in agent metadata)
      const agent = await db
        .prepare(`SELECT metadata FROM agents WHERE id = ?`)
        .bind(agentId)
        .first();

      const metadata = agent?.metadata
        ? JSON.parse(agent.metadata as string)
        : {};

      metadata.subscribed_events = eventTypes;

      await db
        .prepare(`UPDATE agents SET metadata = ? WHERE id = ?`)
        .bind(JSON.stringify(metadata), agentId)
        .run();
    },

    async getSubscriptions(agentId: string): Promise<{
      event_types: NotificationType[];
      webhook_url: string;
    } | null> {
      const agent = await db
        .prepare(`SELECT webhook_url, metadata FROM agents WHERE id = ?`)
        .bind(agentId)
        .first();

      if (!agent?.webhook_url) {
        return null;
      }

      const metadata = agent.metadata
        ? JSON.parse(agent.metadata as string)
        : {};

      return {
        event_types: metadata.subscribed_events || [],
        webhook_url: agent.webhook_url as string,
      };
    },
  };
}

/**
 * Sign webhook payload for verification
 */
async function signPayload(payload: WebhookPayload): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(JSON.stringify(payload) + '-fauxbank-webhook-secret');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Helper to send notifications for common events
 */
export class NotificationHelper {
  private service: NotificationService;

  constructor(db: D1Database) {
    this.service = createNotificationService(db);
  }

  async transactionPosted(agentId: string, transaction: Record<string, unknown>): Promise<void> {
    await this.service.notify(agentId, 'TRANSACTION_POSTED', transaction);
  }

  async authorizationApproved(agentId: string, authorization: Record<string, unknown>): Promise<void> {
    await this.service.notify(agentId, 'AUTHORIZATION_APPROVED', authorization);
  }

  async authorizationDeclined(agentId: string, authorization: Record<string, unknown>): Promise<void> {
    await this.service.notify(agentId, 'AUTHORIZATION_DECLINED', authorization);
  }

  async fraudAlert(agentId: string, alert: Record<string, unknown>): Promise<void> {
    await this.service.notify(agentId, 'FRAUD_ALERT', alert);
  }

  async balanceLow(agentId: string, accountId: string, balance: number, threshold: number): Promise<void> {
    await this.service.notify(agentId, 'BALANCE_LOW', {
      account_id: accountId,
      current_balance: balance,
      threshold,
    });
  }
}
