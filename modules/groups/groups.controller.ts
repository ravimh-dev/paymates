import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import * as groupService from './groups.service';
import {
  sendSuccess, sendCreated, sendValidationError,
} from '../../utils/response-generator';

export const createGroup = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { sendValidationError(res, errors.array()); return; }
    const group = await groupService.createGroup(req.user!.id, req.body);
    sendCreated(res, group, 'Group created');
  } catch (err) { next(err); }
};

export const getGroup = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const group = await groupService.getGroupById(req.params.groupId, req.user!.id);
    sendSuccess(res, group, 'Group fetched');
  } catch (err) { next(err); }
};

export const listGroups = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const groups = await groupService.getUserGroups(req.user!.id);
    sendSuccess(res, groups, 'Groups fetched');
  } catch (err) { next(err); }
};

export const updateGroup = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { sendValidationError(res, errors.array()); return; }
    const group = await groupService.updateGroup(req.params.groupId, req.body);
    sendSuccess(res, group, 'Group updated');
  } catch (err) { next(err); }
};

export const deleteGroup = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    await groupService.deleteGroup(req.params.groupId);
    sendSuccess(res, null, 'Group deleted');
  } catch (err) { next(err); }
};

export const addMember = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { sendValidationError(res, errors.array()); return; }
    await groupService.addMember(req.params.groupId, req.body);
    sendSuccess(res, null, 'Member added');
  } catch (err) { next(err); }
};

export const removeMember = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    await groupService.removeMember(req.params.groupId, req.params.userId);
    sendSuccess(res, null, 'Member removed');
  } catch (err) { next(err); }
};

export const getBalances = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const balances = await groupService.getGroupBalances(req.params.groupId, req.user!.id);
    sendSuccess(res, balances, 'Balances computed');
  } catch (err) { next(err); }
};

export const getInviteLink = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const link = await groupService.generateInviteLink(req.params.groupId, req.user!.id);
    sendSuccess(res, { link }, 'Invite link generated');
  } catch (err) { next(err); }
};

export const joinGroup = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    await groupService.joinByInvite(req.params.token, req.user!.id);
    sendSuccess(res, null, 'Joined group successfully');
  } catch (err) { next(err); }
};
