import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { WithModificationDates } from '@core/database/entities/with-modification-dates';
import { OcrJobStatus } from '@open-receipt-ocr/types';
import { OcrFileEntity } from '@core/database/entities/ocr-file.entity';

@Entity('ocr_jobs')
export class OcrJobEntity extends WithModificationDates {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({
    name: 'status',
    type: 'varchar',
    default: OcrJobStatus.Pending,
  })
  status!: OcrJobStatus;

  @Column({
    name: 'name',
    type: 'varchar',
    nullable: true,
  })
  name?: string;

  @Column({
    name: 'account_id',
    type: 'varchar',
    nullable: true,
  })
  accountId?: string;

  @Column({
    name: 'category_id',
    type: 'varchar',
    nullable: true,
  })
  categoryId?: string;

  @OneToMany(() => OcrFileEntity, (file) => file.job, { cascade: true })
  files!: OcrFileEntity[];
}
