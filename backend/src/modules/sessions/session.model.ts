import {
  Table, Column, Model, DataType, ForeignKey, BelongsTo, Index,
} from 'sequelize-typescript';
import { User } from '../users/user.model';
import { SessionStatus } from '../../shared/types';

@Table({ tableName: 'faculty_sessions', timestamps: true, paranoid: true })
export class Session extends Model {
  @Column({ type: DataType.UUID, defaultValue: DataType.UUIDV4, primaryKey: true })
  id!: string;

  @ForeignKey(() => User)
  @Index
  @Column({ type: DataType.UUID, allowNull: false, field: 'faculty_user_id' })
  facultyId!: string;

  @BelongsTo(() => User)
  faculty!: User;

  @Column({ type: DataType.STRING, allowNull: false, field: 'course_code' })
  courseCode!: string;

  @Column({ type: DataType.STRING, allowNull: false, field: 'course_name' })
  courseName!: string;

  @Column({ type: DataType.STRING, allowNull: false, field: 'session_type' })
  sessionType!: string;

  @Index
  @Column({ type: DataType.DATE, allowNull: false, field: 'scheduled_start' })
  scheduledStartTime!: Date;

  @Column({ type: DataType.DATE, allowNull: false, field: 'scheduled_end' })
  scheduledEndTime!: Date;

  @Column({ type: DataType.DATE, allowNull: true, field: 'actual_start' })
  actualStartTime?: Date;

  @Column({ type: DataType.DATE, allowNull: true, field: 'actual_end' })
  actualEndTime?: Date;

  @Index
  @Column({ type: DataType.ENUM(...Object.values(SessionStatus)), defaultValue: SessionStatus.SCHEDULED })
  status!: SessionStatus;

  @Column({ type: DataType.STRING, allowNull: true, field: 'location_name' })
  location!: string;

  @Column({ type: DataType.GEOMETRY('POINT', 4326), allowNull: true, field: 'location_point' })
  coordinates!: unknown;

  @Column({ type: DataType.INTEGER, defaultValue: 100, field: 'geofence_radius_m' })
  geofenceRadius!: number;

  @Column({ type: DataType.STRING, allowNull: true, field: 'current_qr_token' })
  currentQRToken?: string;

  @Column({ type: DataType.DATE, allowNull: true, field: 'qr_token_expires_at' })
  qrTokenExpiresAt?: Date;

  @Column({ type: DataType.INTEGER, defaultValue: 0, field: 'expected_count' })
  expectedStudents!: number;

  @Column({ type: DataType.INTEGER, defaultValue: 0, field: 'present_count' })
  presentCount!: number;

  @Column({ type: DataType.INTEGER, defaultValue: 0, field: 'absent_count' })
  absentCount!: number;

  @Column({ type: DataType.INTEGER, defaultValue: 0, field: 'late_count' })
  lateCount!: number;

  @Column({ type: DataType.TEXT, allowNull: true })
  notes?: string;
}
