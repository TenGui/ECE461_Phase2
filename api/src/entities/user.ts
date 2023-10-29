import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  user_name!: string;

  @Column()
  user_pass!: string;

  @Column({ default: false })
  is_admin!: boolean;

  @Column()
  token!: string;
}