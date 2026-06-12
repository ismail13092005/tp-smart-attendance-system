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
import { Session } from '../sessions/session.model';
import { AttendanceStatus, VerificationStep } from '../../shared/types';

@Table({
  tableName: 'attendance_records',
  timestamps: true,
  paranoid: true,
})
export class AttendanceRecord extends Model {
  @Column({
    type: DataType.UUID,
    defaultValue: DataType.UUIDV4,
    primaryKey: true,
  })
  id!: string;

  @ForeignKey(() => Session)
  @Index
  @Column({
    type: DataType.UUID,
    allowNull: false,
    field: 'faculty_session_id',
  })
  sessionId!: string;

  @BelongsTo(() => Session)
  session!: Session;

  @ForeignKey(() => User)
  @Index
  @Column({
    type: DataType.UUID,
    allowNull: false,
    field: 'student_user_id',
  })
  studentId!: string;

  @BelongsTo(() => User)
  student!: User;

  @Index
  @Column({
    type: DataType.ENUM(...Object.values(AttendanceStatus)),
    allowNull: false,
  })
  status!: AttendanceStatus;

  @Column({
    type: DataType.DATE,
    allowNull: false,
  })
  markedAt!: Date;

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: false,
  })
  qrVerified!: boolean;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  qrVerifiedAt?: Date;

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: false,
  })
  faceVerified!: boolean;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  faceVerifiedAt?: Date;

  @Column({
    type: DataType.FLOAT,
    allowNull: true,
    comment: 'Face verification confidence score',
  })
  faceConfidence?: number;

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: false,
  })
  geofenceVerified!: boolean;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  geofenceVerifiedAt?: Date;

  @Column({
    type: DataType.GEOMETRY('POINT', 4326),
    allowNull: true,
    comment: 'Student location when marking attendance',
  })
  studentLocation?: any;

  @Column({
    type: DataType.FLOAT,
    allowNull: true,
    comment: 'Distance from session location in meters',
  })
  distanceFromSession?: number;

  @Column({
    type: DataType.STRING,
    allowNull: true,
    comment: 'IP address of the request',
  })
  ipAddress?: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
    comment: 'Device identifier',
  })
  deviceId?: string;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
    comment: 'User agent string',
  })
  userAgent?: string;

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: false,
  })
  isManualOverride!: boolean;

  @Column({
    type: DataType.UUID,
    allowNull: true,
    comment: 'Admin/Faculty who performed manual override',
  })
  overriddenBy?: string;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  overrideReason?: string;

  @Column({
    type: DataType.ENUM(...Object.values(VerificationStep)),
    allowNull: true,
    comment: 'Step where verification failed (if applicable)',
  })
  failedStep?: VerificationStep;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  failureReason?: string;

  @Column({
    type: DataType.JSONB,
    allowNull: true,
    comment: 'Additional verification metadata',
  })
  metadata?: Record<string, any>;
}
