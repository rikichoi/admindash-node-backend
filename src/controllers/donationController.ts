import { NextFunction, Request, Response } from "express";
import stripe from "../lib/stripe";
import { createDonationSchema } from "../lib/validation";
import { ZodError } from "zod";
import createHttpError from "http-errors";
import Donation from "../models/donation";

export const getStripeDonations = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // TODO: Implement pagination feature. this endpoint is currently limited to retrieving 3 itemImageSchema, increase this number
        const balanceTransactions = await stripe.balanceTransactions.list({
            limit: 3,
        });
        res.status(200).json(balanceTransactions.data)
    } catch (error) {
        next(error)
    }
}

export const getDonations = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const donations = await Donation.find().populate('itemId') // multiple path names in one requires mongoose >= 3.6
            .exec();
        res.status(200).json(donations)
    } catch (error) {
        next(error)
    }
}

export const createDonation = async (req: Request, res: Response, next: NextFunction) => {
    try {
        console.log(req.params)

        const data = await createDonationSchema.safeParseAsync(req.params)
        if (data.success) {
            const item = await Donation.create({
                amount: parseInt(data.data?.amount),
                orgId: data.data?.orgId,
                comment: data.data?.comment,
                donorName: (data.data?.donorName || ""),
                email: data.data?.email,
                phone: (data.data?.phone == "null" ? undefined : parseInt(data.data?.phone || "0")),
                itemId: (data.data?.itemId
                     == "null" ? undefined : data.data?.itemId),
            });
            if (item) {
                res.status(201).json({ message: 'Item created successfully' });
            } else {
                res.status(400).json({ message: 'Invalid item data' });
            }
        }
        else {
            throw createHttpError(404, `error: 'Validation error', details: ${data.error} `)

        }

    } catch (error) {
        if (error instanceof ZodError) {
            throw createHttpError(404, `error: 'Invalid data', details: ${error.message} `)
        }
        else {
            next(error)

        }
    }
}