import jwt from "jsonwebtoken"
import User from "../models/user";
import { NextFunction, Request, Response } from "express";
import { createUserSchema, envSanitisedSchema, userSchema } from "../lib/validation";
import createHttpError from "http-errors";
import { ZodError } from "zod";

export const registerUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const data = await createUserSchema.safeParseAsync(req.body);
        if (data.success) {
            const userExists = await User.findOne({ email: data.data.email });
            if (userExists) { res.status(400).json({ message: 'User already exists' }) };

            const user = await User.create({ name: data.data.name, email: data.data.email, password: data.data.password });
            if (user) {
                res.status(201).json({ message: 'User registered successfully' });
            } else {
                res.status(400).json({ message: 'Invalid user data' });
            }
        } else {
            throw createHttpError(400, `'Invalid data', details: ${data.error.message}`);
        }

    } catch (error) {
        if (error instanceof ZodError) {
            throw createHttpError(404, `error: 'Invalid data', details: ${error.message} `)
        }
        else {
            next(error)
        }
    }
};

export const loginUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const data = await userSchema.safeParseAsync(req.body);
        if (data.success) {
            const user = await User.findOne({ email: data.data.email });
            if (!user || !(await user.matchPassword(data.data.password))) {
                res.status(401).json({ message: 'Invalid email or password' });
            }
            else {

                const token = jwt.sign({ id: user._id }, envSanitisedSchema.JWT_SECRET, { expiresIn: '1h' });
                res.json({ token, user: { id: user._id, name: user.name, email: user.email } });
            }
        }
    } catch (error) {
        if (error instanceof ZodError) {
            throw createHttpError(404, `error: 'Invalid data', details: ${error.message} `)
        }
        else {
            next(error)
        }
    }
};