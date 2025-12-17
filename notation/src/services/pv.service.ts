import { PVRepository } from '@repositories/pv.repository';
import { CalculRepository } from '@repositories/calcul.repository';
import { ValidationService } from './validation.service';
import { CreatePVDto, PV } from '@models/PV';
import { PDFUtils } from '@utils/pdf.utils';

PDFUtils.genererPV({
  codeUE,
  anneeAcademique,
  filiere,
  niveau,
  session,
  moyenneUE,
  decision
});


export class PVService {

  private pvRepo = new PVRepository();
  private calculRepo = new CalculRepository();

  async genererPV(data: CreatePVDto): Promise<PV> {

    const moyenne = await this.calculRepo.calculerMoyenneUE(
      data.codeUE,
      data.anneeAcademique,
      data.session
    );

    const decision = ValidationService.verifierDecision(moyenne);

    return this.pvRepo.create({
      ...data,
      moyenneUE: moyenne,
      decision
    });
  }

  async getPV(id: number): Promise<PV | null> {
    return this.pvRepo.findById(id);
  }
}
