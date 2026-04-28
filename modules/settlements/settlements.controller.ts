import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import * as settlementService from './settlements.service';
import { sendSuccess, sendCreated, sendValidationError } from '../../utils/response-generator';

export const getPlan = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const plan = await settlementService.getSettlementPlan(req.params.groupId, req.user!.id);
    sendSuccess(res, plan, 'Settlement plan computed');
  } catch (err) { next(err); }
};

export const execute = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { sendValidationError(res, errors.array()); return; }
    const settlement = await settlementService.executeSettlement(req.user!.id, req.body);
    sendCreated(res, settlement, 'Settlement recorded');
  } catch (err) { next(err); }
};

export const history = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { sendValidationError(res, errors.array()); return; }
    const page = req.query.page ? parseInt(req.query.page as string) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
    const { settlements, total } = await settlementService.getSettlementHistory(req.params.groupId, req.user!.id, page, limit);
    sendSuccess(res, settlements, 'Settlement history fetched', 200, {
      page, limit, total, totalPages: Math.ceil(total / limit),
    });
  } catch (err) { next(err); }
};

export const cancel = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const settlement = await settlementService.cancelSettlement(req.params.settlementId, req.user!.id);
    sendSuccess(res, settlement, 'Settlement cancelled');
  } catch (err) { next(err); }
};

export const exportPdf = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const pdf = await settlementService.exportSettlementPdf(req.params.groupId, req.user!.id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="settlement-${req.params.groupId}.pdf"`
    );
    res.status(200).send(pdf);
  } catch (err) {
    next(err);
  }
};
