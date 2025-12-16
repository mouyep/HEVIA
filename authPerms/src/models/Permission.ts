import { Column, Entity, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'permissions', schema: 'authperms' })
export class Permission {
  @PrimaryGeneratedColumn('uuid')
  id_perm: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  nom_objet_bd: string;

  @Column({ type: 'varchar', length: 50 })
  type_permission: 'read' | 'write' | 'update' | 'delete';

  @Column({ type: 'varchar', length: 255, nullable: true })
  description: string;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  updated_at: Date;

  @Column({ type: 'varchar', length: 50, nullable: true })
  created_by: string;
}