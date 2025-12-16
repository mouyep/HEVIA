import { Column, Entity, PrimaryColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'users', schema: 'authperms' })
export class User {
  @PrimaryColumn({ type: 'varchar', length: 50 })
  matricule: string;

  @Column({ type: 'varchar', length: 20 })
  role: string;

  @Column({ type: 'varchar', length: 255 })
  password: string;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @Column({ type: 'boolean', default: false })
  is_connected: boolean;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  updated_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  last_login_at: Date;

  @Column({ type: 'varchar', length: 50, nullable: true })
  created_by: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  refresh_token_hash: string | null; // Ajouter | null

  @Column({ type: 'timestamp', nullable: true })
  refresh_token_expiry: Date | null; // Ajouter | null
}