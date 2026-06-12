import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
  Index,
} from 'sequelize-typescript';
import { User } from '../users/user.model';
import { AuditAction } from '../../shared/types';

@Table({
  tableName: 'audit_logs',
  timestamps: true,
  updatedAt: false,
  paranoid: false,
})
export class AuditLog extends Model {
  @Column({
    type: DataType.UUID,
    defaultValue: DataType.UUIDV4,
    primaryKey: true,
  })
  id!: string;

  @ForeignKey(() => User)
  @Index
  @Column({
    type: DataType.UUID,
    allowNull: true,
  })
  userId?: string;

  @BelongsTo(() => User)
  user?: User;

  @Index
  @Column({
    type: DataType.ENUM(...Object.values(AuditAction)),
    allowNull: false,
  })
  action!: AuditAction;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  resource!: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  resourceId?: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  ipAddress?: string;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  userAgent?: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  deviceId?: string;

  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
  changes?: Record<string, any>;

  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
  metadata?: Record<string, any>;

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: true,
  })
  success!: boolean;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  errorMessage?: string;

  @Index
  @Column({
    type: DataType.DATE,
    allowNull: false,
    defaultValue: DataType.NOW,
  })
  timestamp!: Date;
}
