import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity()
export class PackageMetaData {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  package_id!: string;

  @Column()
  package_name!: string;

  @Column()
  package_url!: string;

  @Column()
  package_content!: string;

  @Column()
  jsprogram!: string;
}