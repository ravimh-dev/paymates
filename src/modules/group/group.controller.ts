import { Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { ZodError } from 'zod';
import { groupService } from './group.service.ts';
import { createGroupSchema, inviteMemberSchema } from './group.validation.ts';
import { sendSuccess, sendError } from '../../utils/response-generator.ts';

export const create = async (req: any, res: Response) => {
    try {
        const validated = createGroupSchema.parse(req.body);
        const group = await groupService.createGroup(req.user.id, validated);
        return sendSuccess(res, group, 'Group created successfully', StatusCodes.CREATED);
    } catch (error: any) {
        if (error instanceof ZodError) {
            return sendError(res, 'Validation failed', StatusCodes.BAD_REQUEST, error.issues[0].message);
        }
        return sendError(res, error.message || 'Failed to create group');
    }
};

export const invite = async (req: any, res: Response) => {
    try {
        const validated = inviteMemberSchema.parse(req.body);
        await groupService.addMemberByEmail(req.params.id, validated.email, validated.role);
        return sendSuccess(res, null, 'Member invited successfully');
    } catch (error: any) {
        if (error instanceof ZodError) {
            return sendError(res, 'Validation failed', StatusCodes.BAD_REQUEST, error.issues[0].message);
        }
        return sendError(res, error.message || 'Invitation failed');
    }
};
