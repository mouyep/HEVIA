import { pool } from '../utils/database';

export class CalculRepository {

  async calculerMoyenneUE(
    codeUE: string,
    annee: string,
    session: string
  ): Promise<number> {

    const { rows } = await pool.query(
      `SELECT SUM(note * coefficient) / SUM(coefficient) AS moyenne
       FROM notation.notes
       WHERE code_ue=$1 AND annee_academique=$2 AND session=$3`,
      [codeUE, annee, session]
    );

    return rows[0]?.moyenne || 0;
  }
}
