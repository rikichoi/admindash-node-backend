import { NextFunction, Request, Response } from "express";
import stripe from "../lib/stripe";
import { createDonationSchema } from "../lib/validation";
import { ZodError } from "zod";
import createHttpError from "http-errors";
import Donation from "../models/donation";
import Item from "../models/item";
import Organisation from "../models/organisation";
import { isValidObjectId } from "mongoose";

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
        const donations = await Donation.find().populate('itemId', 'name').populate('orgId', 'name') // multiple path names in one requires mongoose >= 3.6
            .exec();
        res.status(200).json(donations)
    } catch (error) {
        next(error)
    }
}

export const createDonation = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = await createDonationSchema.safeParseAsync(req.params)
        if (data.success) {
            const transaction = await Donation.startSession();
            transaction.startTransaction();
            try {
                const organisation = await Organisation.findOne({ _id: data.data.orgId })
                if (organisation) {
                    organisation.totalDonationsValue = parseInt(organisation.totalDonationsValue + data.data.amount)
                    organisation.totalDonationsCount = (organisation.totalDonationsCount + 1)
                    await organisation.save();
                    await Donation.create({
                        amount: parseInt(data.data?.amount),
                        orgId: data.data?.orgId,
                        comment: data.data?.comment,
                        donorName: (data.data?.donorName || ""),
                        email: data.data?.email,
                        phone: (data.data?.phone == "null" ? undefined : parseInt(data.data?.phone || "0")),
                        itemId: (data.data?.itemId
                            == "null" ? undefined : data.data?.itemId),
                    });
                    if (data.data.itemId) {
                        const item = await Item.findOne({ _id: data.data.itemId })
                        console.log(item)
                        if (!item) {
                            await transaction.abortTransaction();
                            res.status(400).json({ message: 'Selected item could not be found' });
                        }
                        else {
                            item.totalDonationValue = (parseInt(item.totalDonationValue + data.data.amount))
                            await item.save();
                            await transaction.commitTransaction();
                            res.status(201).json({ message: "Donation created successfully" })
                        }

                    }
                    await transaction.commitTransaction();
                    res.status(201).json({ message: "Donation created successfully" })
                }
            }
            catch (error) {
                await transaction.abortTransaction();
                res.status(400).json({ message: "Unable to create organistion", error })
            }
        }
    }
    catch (error) {
        if (error instanceof ZodError) {
            throw createHttpError(404, `error: 'Invalid data', details: ${error.message} `)
        }
        else {
            next(error)
        }
    }
}

export const deleteDonation = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const donationId = req.params.donationId
        if (!isValidObjectId(donationId)) {
            res.status(400).json({ message: `Donation with ID: ${donationId} does not exist` })
        }
        const transaction = await Donation.startSession();
        transaction.startTransaction();
        try {
            const donation = await Donation.findOne({ _id: donationId }).exec();
            if (donation) {
                const organisation = await Organisation.findOne({ _id: donation.orgId }).exec();
                if (organisation) {
                    organisation.totalDonationsCount = organisation.totalDonationsCount - 1
                    organisation.totalDonationsValue = organisation.totalDonationsValue - donation.amount
                    await organisation.save();
                    if (donation.itemId) {
                        const item = await Item.findOne({ _id: donation.itemId }).exec();
                        if (item) {
                            item.totalDonationValue = item.totalDonationValue - donation.amount
                            await item.save()
                        }
                        else {
                            await transaction.abortTransaction();
                            res.status(400).json({ message: "Invalid itemId associated with donation" })
                        }
                    }

                    await Donation.deleteOne({ _id: donationId })
                    await transaction.commitTransaction();
                    res.status(200).json({ message: "Donation deleted successfully" })
                }
                else {
                    await transaction.abortTransaction();
                    res.status(400).json({ message: "Organisation not found" })
                }
            }
            else {
                await transaction.abortTransaction();
                res.status(400).json({ message: `Donation with ID: ${donationId} does not exist` })
            }
        }
        catch (error) {
            await transaction.abortTransaction();
            res.status(400).json({ message: "Unable to create organistion", error })
        }
    }
    catch (error) {
        if (error instanceof ZodError) {
            throw createHttpError(404, `error: 'Invalid data', details: ${error.message} `)
        }
        else {
            next(error)
        }
    }
}