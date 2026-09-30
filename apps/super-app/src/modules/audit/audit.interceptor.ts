import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '@app/database';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const req = ctx.getRequest();

    // On ne loggue que les actions qui modifient les données (Pas les simples lectures GET)
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      return next.handle().pipe(
        tap(() => {
          // Exécuté après que l'action ait réussi
          this.logAction(req);
        }),
      );
    }

    return next.handle();
  }

  private async logAction(req: any) {
    try {
      const user = req.user;

      const auditLog = this.auditLogRepository.create({
        userId: user ? user.sub || user.id : 'anonymous',
        action: req.method,
        resource: req.originalUrl,
        ipAddress: req.ip || req.connection?.remoteAddress,
        userAgent: req.headers['user-agent'],
        details: { body: req.body, query: req.query },
      });

      await this.auditLogRepository.save(auditLog);
      this.logger.debug(
        `[AUDIT] ${req.method} ${req.originalUrl} par ${auditLog.userId}`,
      );
    } catch (err) {
      this.logger.error(`Erreur lors de la journalisation d'audit :`, err);
    }
  }
}
