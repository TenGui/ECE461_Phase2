import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user';
import { PackageMetaData } from './packageMetaData';

@Entity()
export class PackageHistory {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => User)
  @JoinColumn()
  user_name!: User;

  @Column()
  user_action!: string;

  @ManyToOne(() => PackageMetaData)
  @JoinColumn()
  package_id!: PackageMetaData;

  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  action_time!: Date;
}