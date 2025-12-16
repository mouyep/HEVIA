import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './User';
import { Permission } from './Permission';

@Entity({ name: 'userperms', schema: 'authperms' })
export class UserPermission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50 })
  mat: string;

  @Column({ type: 'uuid' })
  idperm: string;

  @Column({ type: 'varchar', length: 20, default: 'waiting' })
  statut: 'granted' | 'revoked' | 'waiting';

  @Column({ type: 'timestamp', nullable: true })
  granted_at: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  revoked_at: Date | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  granted_by: string | null;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  updated_at: Date;

  @ManyToOne(() => User, user => user.matricule)
  @JoinColumn({ name: 'mat', referencedColumnName: 'matricule' })
  user: User;

  @ManyToOne(() => Permission, permission => permission.id_perm)
  @JoinColumn({ name: 'idperm', referencedColumnName: 'id_perm' })
  permission: Permission;
}