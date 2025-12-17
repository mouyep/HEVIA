import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

interface PVData {
  codeUE: string;
  anneeAcademique: string;
  filiere: string;
  niveau: string;
  session: string;
  moyenneUE: number;
  decision: string;
}

/**
 * Générateur de PV académique en PDF
 */
export class PDFUtils {

  static genererPV(data: PVData): string {

    const dossier = path.join(__dirname, '../../generated');
    if (!fs.existsSync(dossier)) {
      fs.mkdirSync(dossier);
    }

    const filePath = path.join(
      dossier,
      `PV_${data.codeUE}_${data.anneeAcademique}.pdf`
    );

    const doc = new PDFDocument();
    doc.pipe(fs.createWriteStream(filePath));

    // ----- En-tête -----
    doc.fontSize(16).text('PROCES-VERBAL DE DELIBERATION', {
      align: 'center'
    });

    doc.moveDown();

    // ----- Infos générales -----
    doc.fontSize(12);
    doc.text(`Unité d'Enseignement : ${data.codeUE}`);
    doc.text(`Année académique : ${data.anneeAcademique}`);
    doc.text(`Filière : ${data.filiere}`);
    doc.text(`Niveau : ${data.niveau}`);
    doc.text(`Session : ${data.session}`);

    doc.moveDown();

    // ----- Résultats -----
    doc.text(`Moyenne UE : ${data.moyenneUE}/20`);
    doc.text(`Décision : ${data.decision}`);

    doc.moveDown(2);

    // ----- Signature -----
    doc.text('Fait pour servir et valoir ce que de droit.');
    doc.moveDown(3);
    doc.text('Le Président du Jury', { align: 'right' });

    doc.end();

    return filePath;
  }
}
