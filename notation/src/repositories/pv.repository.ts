import { pool } from '../utils/database';
import { PV } from '@models/PV';

export class PVRepository {

  async create(data: any): Promise<PV> {
    const { rows } = await pool.query(
      `INSERT INTO notation.pv
       (code_ue, annee_academique, session, filiere, niveau, moyenne_ue, decision)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING *`,
      [
        data.codeUE,
        data.anneeAcademique,
        data.session,
        data.filiere,
        data.niveau,
        data.moyenneUE,
        data.decision
      ]
    );
    return rows[0];
  }

  async findById(id: number): Promise<PV | null> {
    const { rows } = await pool.query(
      `SELECT * FROM notation.pv WHERE id=$1`,
      [id]
    );
    return rows[0] || null;
  }
}
