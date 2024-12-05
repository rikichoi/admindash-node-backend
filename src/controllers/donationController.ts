import { NextFunction, Request, Response } from "express";
import stripe from "../lib/stripe";
import { createDonationSchema } from "../lib/validation";
import { ZodError } from "zod";
import createHttpError from "http-errors";
import Donation from "../models/donation";
import Item from "../models/item";
import Organisation from "../models/organisation";
import { isValidObjectId } from "mongoose";
// import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
// import { getSignedUrl } from "@aws-sdk/s3-request-presigner";


// const s3 = new S3Client({
//     credentials: {
//         accessKeyId: envSanitisedSchema.ACCESS_KEY,
//         secretAccessKey: envSanitisedSchema.SECRET_ACCESS_KEY,
//     },
//     region: envSanitisedSchema.BUCKET_REGION
// })

export const getStripeDonations = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const prevPage = req.params.prevPage
        const currentPage = req.params.currentPage
        const lastTransactionId = req.params.lastTransactionId

        if (!prevPage || !currentPage || !lastTransactionId || currentPage == "1" || prevPage == currentPage) {
            const balanceTransactions = await stripe.balanceTransactions.list({
                limit: 8,
            });
            res.status(200).json(balanceTransactions)
        }
        // ugly ass fucking code man
        if (prevPage !== "2" && currentPage !== "1" && prevPage > currentPage) {
            const balanceTransactions = await stripe.balanceTransactions.list({
                limit: 8,
                ending_before: lastTransactionId
            });
            res.status(200).json(balanceTransactions)
        }
        if (prevPage < currentPage) {
            const balanceTransactions = await stripe.balanceTransactions.list({
                limit: 8,
                starting_after: lastTransactionId
            });
            res.status(200).json(balanceTransactions)
        }
    } catch (error) {
        next(error)
    }
}

export const getDonations = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const donations = await Donation.find().populate('itemId').populate('orgId')
            .exec();
        // const donationsWithItems = await Promise.all(donations.map(async (donation) => {
        //     if (donation.orgId) {
        //         const items = await Item.find({ _id: donation.itemId }).exec();
        //         const itemsWithUrls = await Promise.all(items.map(async (item) => {
        //             const command = new GetObjectCommand({ Bucket: envSanitisedSchema.BUCKET_NAME, Key: item.itemImage });
        //             const url = await getSignedUrl(s3, command, { expiresIn: 3600 });
        //             item.itemImage = url;

        //             return items;

        //         }));
        //         console.log(itemsWithUrls)
        //         return items
        //     }
        // }))
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
                    organisation.totalDonationsValue = (Number(organisation.totalDonationsValue) + Number(data.data.amount))
                    organisation.totalDonationsCount = (organisation.totalDonationsCount + 1)
                    await organisation.save();
                    await Donation.create({
                        stripePaymentIntentId: data.data.payment_intent,
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
                        if (data.data.itemId !== null) {
                            const item = await Item.findOne({ _id: data.data.itemId })
                            if (!item) {
                                await transaction.abortTransaction();
                                res.status(400).json({ message: 'Selected item could not be found' });

                            }
                            else {
                                item.totalDonationValue = (Number(item.totalDonationValue) + Number(data.data.amount))
                                await item.save();
                                await transaction.commitTransaction();
                                res.status(201).json({ message: "Donation created successfully" })
                            }
                        }
                        else {
                            await transaction.commitTransaction();
                            res.status(201).json({ message: "Donation created successfully" })
                        }
                    }
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