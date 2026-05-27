import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { WithModificationDates } from '@core/database/entities/with-modification-dates';
import { OcrFileStatus } from '@open-receipt-ocr/types';
import { OcrJobEntity } from '@core/database/entities/ocr-job.entity';
import { OcrExecutionEntity } from '@core/database/entities/ocr-execution.entity';

@Entity('ocr_files')
export class OcrFileEntity extends WithModificationDates {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'job_id', type: 'integer' })
  jobId!: number;
  @ManyToOne(() => OcrJobEntity, (job) => job.files, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'job_id' })
  job!: OcrJobEntity;

  @Column({ name: 'filename', type: 'varchar' })
  filename!: string;

  @Column({ name: 'original_name', type: 'varchar' })
  originalName!: string;

  @Column({
    name: 'status',
    type: 'varchar',
    default: OcrFileStatus.Pending,
  })
  status!: OcrFileStatus;

  @Column({ name: 'wallet_record_id', type: 'varchar', nullable: true })
  walletRecordId?: string;

  @Column({ name: 'wallet_record', type: 'simple-json', nullable: true })
  walletRecord?: any;

  @OneToMany(() => OcrExecutionEntity, (execution) => execution.file, { cascade: true })
  executions!: OcrExecutionEntity[];
}
