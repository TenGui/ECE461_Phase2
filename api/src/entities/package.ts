import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { PackageMetaData } from './packageMetaData';

@Entity()
export class Package {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => PackageMetaData)
  @JoinColumn()
  packageMetaData!: PackageMetaData;

  @Column()
  package_version!: string;

  @Column('bytea')
  package_zip!: Buffer;
}