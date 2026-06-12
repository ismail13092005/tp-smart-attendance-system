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

@Table({
  tableName: 'face_enrollments',
  timestamps: true,
  paranoid: true,
})
export class FaceEnrollment extends Model {
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
    allowNull: false,
  })
  userId!: string;

  @BelongsTo(() => User)
  user!: User;

  @Column({
    type: DataType.TEXT,
    allowNull: false,
    comment: 'Encrypted face descriptor/template',
  })
  encryptedDescriptor!: string;

  @Column({
    type: DataType.FLOAT,
    allowNull: false,
    comment: 'Confidence score from enrollment',
  })
  enrollmentConfidence!: number;

  @Column({
    type: DataType.STRING,
    allowNull: true,
    comment: 'External face service ID if applicable',
  })
  externalFaceId?: string;

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: true,
  })
  isActive!: boolean;

  @Column({
    type: DataType.INTEGER,
    defaultValue: 0,
    comment: 'Number of successful verifications',
  })
  verificationCount!: number;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  lastVerifiedAt?: Date;

  @Column({
    type: DataType.JSONB,
    allowNull: true,
    comment: 'Additional metadata like quality scores, liveness results',
  })
  metadata?: Record<string, any>;

  @Column({
    type: DataType.DATE,
    allowNull: true,
    comment: 'When this enrollment expires (for re-enrollment policies)',
  })
  expiresAt?: Date;
}
