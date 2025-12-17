import { pool } from '../utils/database';

export class EvaluationRepository {

  async create(data: any) {
    const { rows } = await pool.query(
      `INSERT INTO notation.evaluations
       (code_ue, type, coefficient)
       VALUES ($1,$2,$3)
       RETURNING *`,
      [data.codeUE, data.type, data.coefficient]
    );
    return rows[0];
  }

  async findByUE(codeUE: string) {
    const { rows } = await pool.query(
      `SELECT * FROM notation.evaluations WHERE code_ue=$1`,
      [codeUE]
    );
    return rows;
  }
}
