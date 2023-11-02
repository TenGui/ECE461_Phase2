import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { PackageMetaData } from './packageMetaData';

@Entity()
export class PackageMetrics {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => PackageMetaData)
  @JoinColumn()
  packageMetaData!: PackageMetaData;

  @Column()
  NET_SCORE!: number;

  @Column()
  RAMP_UP_SCORE!: number;

  @Column()
  CORRECTNESS_SCORE!: number;

  @Column()
  BUS_FACTOR_SCORE!: number;

  @Column()
  RESPONSIVE_MAINTAINER_SCORE!: number;

  @Column()
  LICENSE_SCORE!: number;

  @Column()
  PR_STATS!: number;

  @Column()
  DEPEND_SCORE!: number;
}